//! Pure pricing candidate, not a registered Shopify extension. See README.
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Deserialize)]
pub struct Input {
    pub cart: Cart,
}
#[derive(Debug, Deserialize)]
pub struct Cart {
    pub lines: Vec<Line>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Line {
    pub id: String,
    pub quantity: u32,
    pub cost: Cost,
    pub selling_plan_allocation: Option<serde_json::Value>,
    pub merchandise: Merchandise,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cost {
    pub amount_per_quantity: Money,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Money {
    pub currency_code: String,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "__typename")]
pub enum Merchandise {
    ProductVariant {
        id: String,
        tiers: Option<Metafield>,
    },
    #[serde(other)]
    Other,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metafield {
    pub json_value: serde_json::Value,
}
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Ladder {
    pub version: u32,
    pub variant_id: String,
    pub currency: String,
    pub source_revision: String,
    pub tiers: Vec<Tier>,
}
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Tier {
    pub min_qty: u32,
    pub unit_cents: u32,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Output {
    pub operations: Vec<Operation>,
}
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Operation {
    pub line_update: LineUpdate,
}
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LineUpdate {
    pub cart_line_id: String,
    pub price: Price,
}
#[derive(Debug, Serialize, PartialEq)]
pub struct Price {
    pub adjustment: Adjustment,
}
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Adjustment {
    pub fixed_price_per_unit: Amount,
}
#[derive(Debug, Serialize, PartialEq)]
pub struct Amount {
    pub amount: String,
}

fn validate(ladder: &Ladder, variant_id: &str, currency: &str) -> Result<(), String> {
    if ladder.version != 1
        || ladder.variant_id != variant_id
        || !variant_id.starts_with("gid://shopify/ProductVariant/")
        || ladder.currency != "USD"
        || currency != ladder.currency
        || ladder.source_revision.trim().is_empty()
        || ladder.tiers.is_empty()
        || ladder.tiers.len() > 32
        || ladder.tiers[0].min_qty != 1
    {
        return Err("Invalid tier identity, currency, version or provenance".into());
    }
    for (i, tier) in ladder.tiers.iter().enumerate() {
        if tier.unit_cents == 0
            || tier.unit_cents > 100_000_000
            || (i > 0
                && (tier.min_qty <= ladder.tiers[i - 1].min_qty
                    || tier.unit_cents > ladder.tiers[i - 1].unit_cents))
        {
            return Err("Invalid tier boundaries or unit price".into());
        }
    }
    Ok(())
}

/// Produces fixed unit prices from trusted Shopify variant metafields only.
/// Errors MUST block checkout after CLI integration (blockOnFailure=true).
/// Missing ladders are out of rollout scope; the storefront parity guard must
/// prevent a tier-promised line from redirecting when its ladder is missing.
pub fn transform(input: &Input) -> Result<Output, String> {
    let mut line_ids = HashSet::new();
    let mut variants: HashMap<&str, (u32, Option<Ladder>)> = HashMap::new();
    for line in &input.cart.lines {
        if line.quantity == 0
            || !line_ids.insert(&line.id)
            || !line.id.starts_with("gid://shopify/CartLine/")
        {
            return Err("Invalid cart line identity or quantity".into());
        }
        let Merchandise::ProductVariant { id, tiers } = &line.merchandise else {
            continue;
        };
        let ladder = match tiers {
            None => None,
            Some(meta) => {
                let ladder: Ladder = serde_json::from_value(meta.json_value.clone())
                    .map_err(|_| "Malformed tier metafield")?;
                validate(&ladder, id, &line.cost.amount_per_quantity.currency_code)?;
                if line.selling_plan_allocation.is_some() {
                    return Err("Tiered selling-plan lines are unsupported".into());
                }
                Some(ladder)
            }
        };
        match variants.get_mut(id.as_str()) {
            Some((quantity, previous)) => {
                if *previous != ladder {
                    return Err("Inconsistent ladder for split variant".into());
                }
                *quantity = quantity
                    .checked_add(line.quantity)
                    .ok_or("Quantity overflow")?;
            }
            None => {
                variants.insert(id, (line.quantity, ladder));
            }
        }
    }
    let mut operations = Vec::new();
    for line in &input.cart.lines {
        let Merchandise::ProductVariant { id, .. } = &line.merchandise else {
            continue;
        };
        let Some((quantity, Some(ladder))) = variants.get(id.as_str()) else {
            continue;
        };
        let cents = ladder
            .tiers
            .iter()
            .rev()
            .find(|tier| tier.min_qty <= *quantity)
            .ok_or("No applicable tier")?
            .unit_cents;
        operations.push(Operation {
            line_update: LineUpdate {
                cart_line_id: line.id.clone(),
                price: Price {
                    adjustment: Adjustment {
                        fixed_price_per_unit: Amount {
                            amount: format!("{}.{:02}", cents / 100, cents % 100),
                        },
                    },
                },
            },
        });
    }
    Ok(Output { operations })
}

#[cfg(test)]
mod tests;
