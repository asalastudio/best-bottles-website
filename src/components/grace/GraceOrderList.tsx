"use client";
import { useEffect, useRef, useState } from "react";
import { UploadSimple, ArrowLeft } from "@phosphor-icons/react";
import { useGrace } from "@/components/useGrace";
import { useAppLocale } from "@/i18n/useCopy";
import { parseOrderList, resolveOrderListProduct, OrderListParseError } from "@/lib/grace/orderList";
import type { PendingCartProduct } from "@/components/GraceContext";
import styles from "./GraceShop.module.css";

export default function GraceOrderList({ onClose }: { onClose: () => void }) {
    const { appendInlineMessage, ownerKey } = useGrace();
    const es = useAppLocale() === "es";
    const [text, setText] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const mounted = useRef(true);
    const requestRef = useRef<AbortController | null>(null);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; requestRef.current?.abort(); };
    }, []);
    const errors = es ? {
        empty: "Agrega al menos un SKU y su cantidad.", format: "Usa columnas SKU y Quantity en un archivo CSV o TSV.",
        quantity: "Las cantidades deben ser números enteros entre 1 y 100.000.", tooMany: "Puedes revisar hasta 50 filas a la vez.", tooLarge: "Usa un archivo de menos de 256 KB.",
    } : {
        empty: "Add at least one SKU and quantity.", format: "Use SKU and Quantity columns in a CSV or TSV file.",
        quantity: "Quantities must be whole numbers between 1 and 100,000.", tooMany: "Review up to 50 rows at a time.", tooLarge: "Use a file smaller than 256 KB.",
    };
    const review = async () => {
        setError("");
        let lines;
        try { lines = parseOrderList(text); } catch (e) { setError(errors[e instanceof OrderListParseError ? e.code : "format"]); return; }
        setBusy(true);
        const controller = new AbortController();
        requestRef.current = controller;
        const accepted: PendingCartProduct[] = []; const flagged: string[] = [];
        try {
            for (const line of lines) {
                const response = await fetch("/api/grace/tools", {
                    method: "POST", headers: { "Content-Type": "application/json", "x-grace-owner-key": ownerKey },
                    body: JSON.stringify({ tool_name: "getProductBySku", parameters: { sku: line.sku } }),
                    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
                });
                if (!response.ok) throw new Error("lookup");
                const payload = await response.json();
                const product = resolveOrderListProduct(line, payload.result);
                if (product) accepted.push(product); else flagged.push(line.sku);
            }
            if (!mounted.current) return;
            appendInlineMessage({ role: "user", content: `${es ? "Revisar lista de pedido" : "Review order list"}:\n${lines.map(line => `${line.sku} × ${line.quantity}`).join("\n")}` });
            const summary = es
                ? `${accepted.length} líneas listas para revisar. Confirma los artículos antes de agregarlos al carrito. La compatibilidad entre componentes aún debe comprobarse.`
                : `${accepted.length} lines ready to review. Confirm the items below before adding them to your cart. Component compatibility still needs to be checked.`;
            appendInlineMessage({ role: "grace", content: summary + (flagged.length ? `\n\n${es ? "Requieren revisión del equipo (SKU, disponibilidad o precio)" : "Need team review (SKU, availability or price)"}: ${flagged.join(", ")}` : ""),
                action: accepted.length ? { type: "proposeCartAdd", confirmationId: crypto.randomUUID(), products: accepted, awaitingConfirmation: true } : undefined });
            onClose();
        } catch { if (mounted.current) setError(es ? "No se pudo consultar el catálogo. Intenta de nuevo; no se agregó nada al carrito." : "The catalog could not be checked. Try again; nothing was added to your cart."); }
        finally { if (mounted.current) setBusy(false); }
    };
    return <section className={styles.orderList} aria-label={es ? "Subir lista de pedido" : "Upload an order list"}>
        <button type="button" onClick={onClose} disabled={busy}><ArrowLeft size={15} /> {es ? "Volver a Grace" : "Back to Grace"}</button>
        <h2>{es ? "Tu lista de pedido" : "Your order list"}</h2>
        <p>{es ? "Sube un CSV o TSV, o pega las columnas SKU y cantidad desde Excel. Hasta 50 filas." : "Upload a CSV or TSV, or paste SKU and quantity columns from Excel. Up to 50 rows."}</p>
        <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" hidden onChange={async event => {
            const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
            if (file.size > 262144) { setError(errors.tooLarge); return; }
            if (!/\.(csv|tsv)$/i.test(file.name)) { setError(errors.format); return; }
            try { setText(await file.text()); setError(""); } catch { setError(errors.format); }
        }} />
        <button className={styles.uploadButton} type="button" disabled={busy} onClick={() => fileRef.current?.click()}><UploadSimple size={18} /> {es ? "Elegir archivo" : "Choose file"}</button>
        <label htmlFor="grace-order-list">SKU, {es ? "cantidad" : "quantity"}</label>
        <textarea id="grace-order-list" value={text} disabled={busy} onChange={event => setText(event.target.value)} placeholder={"SKU,Quantity\nYOUR-SKU,144"} rows={7} maxLength={262144} />
        <p>{es ? "Solo se consultan los SKU y cantidades. Revisa los resultados antes de agregarlos al carrito." : "Only SKUs and quantities are checked. Review the results before adding anything to your cart."}</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.reviewOrder} type="button" disabled={busy || !text.trim()} onClick={() => void review()}>{busy ? (es ? "Consultando catálogo…" : "Checking catalog…") : (es ? "Revisar artículos" : "Review items")}</button>
    </section>;
}
