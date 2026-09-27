import { useAppLocale } from "@/i18n/useCopy";

const en = {
    voice: "Voice", stopVoice: "End", orderList: "Upload an order list", menu: "Grace menu", newChat: "New conversation", expand: "Expand to full-screen chat", close: "Close Grace",
    concierge: "AI concierge · Best Bottles", morning: "Good morning.", afternoon: "Good afternoon.", evening: "Good evening.",
    greeting: "What are you packaging today?", disclaimer: "Grace is an AI assistant.", privacy: "Privacy Policy", terms: "Terms",
    intents: ["Find a bottle", "Check compatibility", "Volume pricing"],
    prompts: ["Help me find a bottle for my product.", "Help me check which components fit my bottle or neck finish.", "Help me get volume pricing for my order."],
    seeing: "Grace can see:", home: "Best Bottles homepage", catalog: "Catalog", cartPage: "Your cart", page: "Current page",
    placeholder: "Ask Grace anything…", verify: "Verify details before ordering.", person: "Talk to a person",
    account: "Your account", orders: "Reorder or track an order", samples: "Request samples", attach: "Attach a reference image", imageHint: "PNG, JPG or WebP · up to 8 MB",
    conversation: "Your conversation", noConversation: "Start a conversation to find bottles and check fitment.", current: "Current conversation", workspace: "Open full-screen workspace",
    cart: "Cart", lines: "lines", pieces: "pcs", viewCart: "View cart", checkout: "Checkout", checkingOut: "Opening checkout…",
    minimumMet: "$50 order minimum reached", minimumMore: "more to reach the $50 minimum", quoteOnly: "Some items need a quote. Review your cart.",
    finding: "Finding…", ask: "Ask Grace", unread: "Unread reply", send: "Send message", helpful: "Helpful answer", unhelpful: "Unhelpful answer", feedback: "Thanks for your feedback", answer: "Grace answer", liveCatalog: "Catalog results", thinking: "Grace is thinking…",
};
const es: typeof en = {
    voice: "Voz", stopVoice: "Terminar", orderList: "Subir lista de pedido", menu: "Menú de Grace", newChat: "Nueva conversación", expand: "Ampliar chat a pantalla completa", close: "Cerrar Grace",
    concierge: "Asistente de IA · Best Bottles", morning: "Buenos días.", afternoon: "Buenas tardes.", evening: "Buenas noches.",
    greeting: "¿Qué vas a envasar hoy?", disclaimer: "Grace es un asistente de IA.", privacy: "Política de privacidad", terms: "Términos",
    intents: ["Encontrar una botella", "Comprobar compatibilidad", "Precios por volumen"],
    prompts: ["Ayúdame a encontrar una botella para mi producto.", "Ayúdame a comprobar qué componentes son compatibles con mi botella o cuello.", "Ayúdame a consultar precios por volumen para mi pedido."],
    seeing: "Grace puede ver:", home: "Inicio de Best Bottles", catalog: "Catálogo", cartPage: "Tu carrito", page: "Página actual",
    placeholder: "Pregúntale a Grace…", verify: "Verifica los detalles antes de comprar.", person: "Hablar con una persona",
    account: "Tu cuenta", orders: "Repetir o rastrear un pedido", samples: "Solicitar muestras", attach: "Adjuntar imagen de referencia", imageHint: "PNG, JPG o WebP · hasta 8 MB",
    conversation: "Tu conversación", noConversation: "Inicia una conversación para encontrar botellas y comprobar compatibilidad.", current: "Conversación actual", workspace: "Abrir espacio a pantalla completa",
    cart: "Carrito", lines: "líneas", pieces: "uds.", viewCart: "Ver carrito", checkout: "Pagar", checkingOut: "Abriendo pago…",
    minimumMet: "Mínimo de $50 alcanzado", minimumMore: "para alcanzar el mínimo de $50", quoteOnly: "Algunos artículos requieren cotización. Revisa tu carrito.",
    finding: "Buscando…", ask: "Pregunta a Grace", unread: "Respuesta sin leer", send: "Enviar mensaje", helpful: "Respuesta útil", unhelpful: "Respuesta poco útil", feedback: "Gracias por tu opinión", answer: "Respuesta de Grace", liveCatalog: "Resultados del catálogo", thinking: "Grace está pensando…",
};
export function useGraceRedesignCopy() { return useAppLocale() === "es" ? es : en; }
