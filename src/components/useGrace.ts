/**
 * Shared Grace context barrel.
 *
 * Both GraceProvider (OpenAI) and GraceElevenLabsProvider (ElevenLabs)
 * register under the same GraceContext. Components should always import
 * from here, never from a specific provider.
 *
 * The active provider is selected by GraceProviderSwitch based on
 * NEXT_PUBLIC_GRACE_VOICE_PROVIDER ("elevenlabs" | "openai").
 */

export {
    useGrace,
    type GraceStatus,
    type GraceAction,
    type GraceMessage,
    type ProductCard,
    type KitItem,
    type PanelMode,
} from "./GraceContext";
