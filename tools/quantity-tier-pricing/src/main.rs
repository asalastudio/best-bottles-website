// Local JSON fixture runner only. This is NOT Shopify's Wasm ABI entry point.
use best_bottles_tier_pricing_candidate::{transform, Input};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let input: Input = serde_json::from_reader(std::io::stdin())?;
    let output = transform(&input).map_err(std::io::Error::other)?;
    serde_json::to_writer(std::io::stdout(), &output)?;
    Ok(())
}
