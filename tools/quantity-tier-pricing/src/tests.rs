use super::*;
fn fixture() -> serde_json::Value {
    serde_json::from_str(include_str!("../fixtures/elegant-60.json")).unwrap()
}
fn run(value: serde_json::Value) -> Result<Output, String> {
    transform(&serde_json::from_value(value).map_err(|e| e.to_string())?)
}
fn price(output: &Output, index: usize) -> &str {
    &output.operations[index]
        .line_update
        .price
        .adjustment
        .fixed_price_per_unit
        .amount
}
#[test]
fn exact_published_tier_boundaries() {
    for (qty, expected) in [
        (1, "0.88"),
        (11, "0.88"),
        (12, "0.84"),
        (13, "0.84"),
        (60, "0.84"),
        (143, "0.84"),
        (144, "0.79"),
        (145, "0.79"),
        (287, "0.79"),
        (288, "0.75"),
        (289, "0.75"),
        (1439, "0.75"),
        (1440, "0.69"),
        (1441, "0.69"),
    ] {
        let mut value = fixture();
        value["cart"]["lines"][0]["quantity"] = qty.into();
        assert_eq!(price(&run(value).unwrap(), 0), expected, "quantity {qty}");
    }
}
#[test]
fn sixty_unit_output_matches_shopify_shape() {
    let output = serde_json::to_value(run(fixture()).unwrap()).unwrap();
    let expected: serde_json::Value =
        serde_json::from_str(include_str!("../fixtures/elegant-60.expected.json")).unwrap();
    assert_eq!(output, expected);
}
#[test]
fn checkout_quantity_changes_recompute_both_up_and_down() {
    let mut value = fixture();
    for (qty, expected) in [
        (60, "0.84"),
        (11, "0.88"),
        (144, "0.79"),
        (12, "0.84"),
        (1, "0.88"),
    ] {
        value["cart"]["lines"][0]["quantity"] = qty.into();
        assert_eq!(price(&run(value.clone()).unwrap(), 0), expected);
    }
}
#[test]
fn aggregates_split_lines_of_same_variant() {
    let mut value = fixture();
    value["cart"]["lines"][0]["quantity"] = 6.into();
    let mut second = value["cart"]["lines"][0].clone();
    second["id"] = "gid://shopify/CartLine/2".into();
    value["cart"]["lines"].as_array_mut().unwrap().push(second);
    let output = run(value).unwrap();
    assert_eq!(output.operations.len(), 2);
    assert_eq!(price(&output, 0), "0.84");
    assert_eq!(price(&output, 1), "0.84");
}
#[test]
fn different_variants_do_not_share_quantity_breaks() {
    let mut value = fixture();
    value["cart"]["lines"][0]["quantity"] = 6.into();
    let mut second = value["cart"]["lines"][0].clone();
    second["id"] = "gid://shopify/CartLine/2".into();
    second["merchandise"]["id"] = "gid://shopify/ProductVariant/456".into();
    second["merchandise"]["tiers"]["jsonValue"]["variantId"] =
        "gid://shopify/ProductVariant/456".into();
    value["cart"]["lines"].as_array_mut().unwrap().push(second);
    let output = run(value).unwrap();
    assert_eq!(price(&output, 0), "0.88");
    assert_eq!(price(&output, 1), "0.88");
}
#[test]
fn invalid_ladders_fail_instead_of_returning_base_price() {
    for (field, bad) in [
        ("version", serde_json::json!(2)),
        (
            "variantId",
            serde_json::json!("gid://shopify/ProductVariant/999"),
        ),
        ("currency", serde_json::json!("CAD")),
        ("sourceRevision", serde_json::json!("")),
        ("tiers", serde_json::json!([])),
        ("tiers", serde_json::json!([{"minQty":12,"unitCents":84}])),
        (
            "tiers",
            serde_json::json!([{"minQty":1,"unitCents":88},{"minQty":1,"unitCents":84}]),
        ),
        (
            "tiers",
            serde_json::json!([{"minQty":1,"unitCents":88},{"minQty":12,"unitCents":99}]),
        ),
        ("tiers", serde_json::json!([{"minQty":1,"unitCents":0}])),
    ] {
        let mut value = fixture();
        value["cart"]["lines"][0]["merchandise"]["tiers"]["jsonValue"][field] = bad;
        assert!(run(value).is_err(), "invalid {field}");
    }
}
#[test]
fn unsupported_currency_and_selling_plan_fail() {
    let mut value = fixture();
    value["cart"]["lines"][0]["cost"]["amountPerQuantity"]["currencyCode"] = "CAD".into();
    assert!(run(value).is_err());
    let mut value = fixture();
    value["cart"]["lines"][0]["sellingPlanAllocation"] =
        serde_json::json!({"sellingPlan":{"id":"gid://shopify/SellingPlan/1"}});
    assert!(run(value).is_err());
}
#[test]
fn non_rollout_and_custom_lines_are_untouched() {
    let mut value = fixture();
    value["cart"]["lines"][0]["merchandise"]["tiers"] = serde_json::Value::Null;
    assert!(run(value.clone()).unwrap().operations.is_empty());
    value["cart"]["lines"][0]["merchandise"] = serde_json::json!({"__typename":"CustomProduct"});
    assert!(run(value).unwrap().operations.is_empty());
}
#[test]
fn rejects_invalid_quantities_ids_and_overflow() {
    for qty in [
        serde_json::json!(0),
        serde_json::json!(-1),
        serde_json::json!(1.5),
    ] {
        let mut value = fixture();
        value["cart"]["lines"][0]["quantity"] = qty;
        assert!(run(value).is_err());
    }
    let mut value = fixture();
    let second = value["cart"]["lines"][0].clone();
    value["cart"]["lines"].as_array_mut().unwrap().push(second);
    assert!(run(value).is_err());
    let mut value = fixture();
    value["cart"]["lines"][0]["quantity"] = u32::MAX.into();
    let mut second = value["cart"]["lines"][0].clone();
    second["id"] = "gid://shopify/CartLine/2".into();
    value["cart"]["lines"].as_array_mut().unwrap().push(second);
    assert!(run(value).is_err());
}
#[test]
fn inconsistent_split_line_metadata_fails() {
    let mut value = fixture();
    let mut second = value["cart"]["lines"][0].clone();
    second["id"] = "gid://shopify/CartLine/2".into();
    second["merchandise"]["tiers"] = serde_json::Value::Null;
    value["cart"]["lines"].as_array_mut().unwrap().push(second);
    assert!(run(value).is_err());
}
#[test]
fn browser_supplied_prices_are_not_authority() {
    let mut value = fixture();
    value["cart"]["lines"][0]["attributes"] =
        serde_json::json!([{"key":"unitPrice","value":"0.01"}]);
    value["cart"]["lines"][0]["cost"]["amountPerQuantity"]["amount"] = "0.01".into();
    assert_eq!(price(&run(value).unwrap(), 0), "0.84");
}
#[test]
fn malformed_metafield_is_not_silently_ignored() {
    let mut value = fixture();
    value["cart"]["lines"][0]["merchandise"]["tiers"]["jsonValue"] = serde_json::json!("bad");
    assert!(run(value).is_err());
}

#[test]
fn mixed_rollout_cart_only_updates_configured_variant() {
    let mut value = fixture();
    let mut second = value["cart"]["lines"][0].clone();
    second["id"] = "gid://shopify/CartLine/2".into();
    second["merchandise"]["id"] = "gid://shopify/ProductVariant/456".into();
    second["merchandise"]["tiers"] = serde_json::Value::Null;
    value["cart"]["lines"].as_array_mut().unwrap().push(second);
    let output = run(value).unwrap();
    assert_eq!(output.operations.len(), 1);
    assert_eq!(
        output.operations[0].line_update.cart_line_id,
        "gid://shopify/CartLine/1"
    );
    assert_eq!(price(&output, 0), "0.84");
}

#[test]
fn split_variant_rejects_different_valid_ladder_or_currency() {
    for different_currency in [false, true] {
        let mut value = fixture();
        let mut second = value["cart"]["lines"][0].clone();
        second["id"] = "gid://shopify/CartLine/2".into();
        if different_currency {
            second["cost"]["amountPerQuantity"]["currencyCode"] = "CAD".into();
        } else {
            second["merchandise"]["tiers"]["jsonValue"]["tiers"][1]["unitCents"] = 83.into();
        }
        value["cart"]["lines"].as_array_mut().unwrap().push(second);
        assert!(run(value).is_err());
    }
}

#[test]
fn excessive_ladder_size_and_price_are_rejected() {
    let mut value = fixture();
    let tiers: Vec<serde_json::Value> = (1..=33)
        .map(|q| serde_json::json!({"minQty":q,"unitCents":88}))
        .collect();
    value["cart"]["lines"][0]["merchandise"]["tiers"]["jsonValue"]["tiers"] = tiers.into();
    assert!(run(value).is_err());
    let mut value = fixture();
    value["cart"]["lines"][0]["merchandise"]["tiers"]["jsonValue"]["tiers"][0]["unitCents"] =
        100_000_001.into();
    assert!(run(value).is_err());
}
