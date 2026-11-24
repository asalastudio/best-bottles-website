/**
 * Which closure component a finished catalog option uses, read from the option's SKU: the finish token
 * after the closure marker (Rdcr, Drpr, Spry, Roll, CapSht...), on the option's neck. Used by
 * map-cap-swatch-photos.mts to file each option under the component SKU its PSD photo is keyed by.
 * Conservative on purpose: a SKU that does not match a rule exactly gets no photo rather than a guess.
 */
/** Closure finish token in a finished product's SKU -> the component SKU its photo is filed under. */
export function componentForOption(sku: string, neck: string | null): string | undefined {
    let m: RegExpMatchArray | null;
    const pick = (table: Record<string, string>, token: string | undefined) => (token ? table[token] : undefined);
    switch (neck) {
        case "18-415":
            if ((m = sku.match(/Rdcr(\w+)$/))) {
                const alias: Record<string, string> = { Wht: "Wh", IvyLthr: "LIvyLthr", PnkLthr: "LPnkLthr" };
                return `CP18-415${alias[m[1]] ?? m[1]}`;
            }
            if (/Wht(?:Rect)?ClOv(?:e)?rC(?:a)?p$/.test(sku)) return "Ltn18-415SqClr";
            if (/(?:Ltn|MtSl)Cl(?:r)?Ov(?:e)?rCap$/.test(sku)) return "Ltn18-415MtSlCl";
            if ((m = sku.match(/AnSp(Wht|Lvn|Pnk|MtSl|IvySl|Gl|IvyGl|Blk|Red)$/))) return `AnSp18-415${m[1]}`;
            return undefined;
        case "18-400":
            if (/(?:Blk|Black)CapSht$/.test(sku)) return "18-400CpShortBlk";
            if ((m = sku.match(/(Blk|Wht)(?:Dropper|Drpr)(Gl|Sl)?(Trim)?$/))) {
                const bulb = m[1] === "Blk" ? "BlkBulb" : "WhiteBulb";
                return `Drp18-40015ml${m[2] ? `Shn${m[2]}Trim${bulb}` : m[1] === "Blk" ? "BlckBulb" : "WhiteBulb"}`;
            }
            return undefined;
        case "20-400":
            if ((m = sku.match(/(1oz|2oz)BlkCapSht$/))) return m[1] === "1oz" ? "20-400cp1ozShortBlk" : "20-400Cp2ozShortBlk";
            if ((m = sku.match(/(1oz|2oz)(Blk|Wht)(?:Dropper|Drpr|Drp)(?:Shn)?(Gl|Sl)?(?:Trim)?$/))) {
                const [, size, bulb, trim] = m;
                if (!trim) return `Drp20-400${size}${bulb === "Blk" ? "BlckBulb" : "WhiteBulb"}`;
                return `Drp20-400${size}${bulb === "Wht" ? "l" : ""}Shn${trim}Trim${bulb === "Blk" ? "BlkBulb" : "WhiteBulb"}`;
            }
            if ((m = sku.match(/Roll(?:on)?(Matt|Shn|Sh)?(Blk|Gl|Sl)$/))) return `CPRoll20-400Tall${m[1] === "Matt" ? "Matt" : "Shn"}${m[2]}`;
            return undefined;
        case "13-415":
            if (/Spry/.test(sku)) {
                return pick({ SlMatt: "SlMt", SlMt: "SlMt", GlSh: "GlSh", SlSh: "SlSh", BlkMatt: "BlkMt", BlkSh: "BlkSh",
                    BluMatt: "BluMt", CuMatt: "CuMt", GlMatt: "GlMt" }, sku.match(/Spry(\w+)$/)?.[1])?.replace(/^/, "CP13-415Spry");
            }
            if (/Roll/.test(sku)) {
                return pick({ PinkDot: "PinkDot", PinkDo: "PinkDot", BlkDot: "BlackDot", SlDot: "SlDot", SlMatt: "SlMt", GlMatt: "GlMt",
                    GlSh: "GlSh", SlSh: "SlSh", CuMatt: "Cu", BlkSh: "BlkSh" }, sku.match(/Roll(?:on)?(\w+)$/)?.[1])?.replace(/^/, "CPRoll13-415");
            }
            if (/BlkSht$/.test(sku) && !/(?:BlkSh|Matt)Sht$/.test(sku)) return "CP13-415BlkSht";
            if (/WhtSht$/.test(sku)) return "CP13-415WhtSht";
            if (/\d(?:Gl)$/.test(sku)) return "CP13-415Gl";
            if (/\d(?:Sl)$/.test(sku)) return "CP13-415Sl";
            return undefined;
        case "13-425":
            if (/(?:Black|Blk)CapSht$/.test(sku)) return "CP13-425Blk";
            if (/WhtCapSht$/.test(sku)) return "CP13-425Wht";
            if (/Blk(?:Dropper|Drpr)$/.test(sku)) return "Drp13-425Blk";
            return undefined;
        case "14.3mm":
            return /TPlGl$/.test(sku) ? "CP14mmAppShnGlRedDot" : undefined;
        case "15-415":
            if (/\dGl(?:Cap)?$/.test(sku)) return "CP15-415ShnGl";
            if (/\dSl(?:Cap)?$/.test(sku)) return "CP15-415ShnSl";
            return undefined;
        case "17-415":
            return pick({ Rd: "Red", Red: "Red", Tur: "Tur", Blk: "Blk", Gl: "Gl", ShnSl: "ShnSl", MattSl: "MattSl" },
                sku.match(/Spry(\w+)$/)?.[1])?.replace(/^/, "Spry17-415");
        case "8-425":
            if ((m = sku.match(/Amb2(Black|Wht)Cap$/))) return m[1] === "Black" ? "8-425CpShortBlack" : "8-425CpShortWhite";
            if ((m = sku.match(/Clr2ml(Black|Wht)Cap$/))) return m[1] === "Black" ? "CP8-425TallBlack" : "CP8-425TallWhite";
            return undefined;
        case "8mm":
            if (/KeyGld$/.test(sku)) return "CP8-425GlChainShortShnGlCap";
            if (/TslRed$/.test(sku)) return "CP8-425RedTslShortShnGlCap";
            return undefined;
        case "Plug":
            if (/1ml\w*V(?:ial)?Blk$/.test(sku)) return "ROD1mlBlk";
            if (/1ml\w*V(?:ial)?Wht$/.test(sku)) return "ROD1mlWhite";
            return undefined;
        case "12mm":
            if (/Spry\d+mlCl(?:Blk)$/.test(sku)) return "Spry12mmBlk";
            if (/Spry\d+mlCl(?:Wht|Wh)$/.test(sku)) return "Spry12mmWht";
            return undefined;
        default:
            return undefined;
    }
}

