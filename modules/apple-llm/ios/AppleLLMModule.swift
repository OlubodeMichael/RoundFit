import ExpoModulesCore
import Foundation

#if canImport(FoundationModels)
import FoundationModels

// Structured output for the daily coaching card. Guided generation fills this
// struct directly, which removes the small-model failure modes (rambling,
// malformed output). @Guide descriptions mirror the coach-voice rules in
// DAILY_INSIGHT_SYSTEM_PROMPT (backend) — see DAILY_COACHING_TEMPLATE.md.
@available(iOS 26.0, *)
@Generable
struct DailyCoaching {
    @Guide(description: "Headline of 3 to 6 words naming the single most important thing from the data. No colon, no em-dash, no bullets.")
    var title: String

    @Guide(description: "2 to 3 sentences. Reference specific numbers from the data. Connect cause and effect. End by telling them what to do today. Warm and direct, no corporate tone. No lists, headers, or em-dashes. Do not start with 'I' or 'As your coach'.")
    var message: String

    @Guide(description: "The primary focus of today's coaching.")
    var focus: Focus

    @Generable
    enum Focus: String {
        case nutrition
        case training
        case recovery
        case hydration
        case consistency
    }
}
#endif

public class AppleLLMModule: Module {
    public func definition() -> ModuleDefinition {
        Name("AppleLLM")

        // Synchronous capability check. Routing source of truth — NOT a device
        // model list. Returns { available: Bool, reason?: String }.
        Function("isAvailable") { () -> [String: Any] in
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                switch SystemLanguageModel.default.availability {
                case .available:
                    return ["available": true]
                case .unavailable(let reason):
                    let reasonStr: String
                    switch reason {
                    case .deviceNotEligible:            reasonStr = "deviceNotEligible"
                    case .appleIntelligenceNotEnabled:  reasonStr = "appleIntelligenceNotEnabled"
                    case .modelNotReady:                reasonStr = "modelNotReady"
                    @unknown default:                   reasonStr = "unknown"
                    }
                    return ["available": false, "reason": reasonStr]
                }
            }
            #endif
            return ["available": false, "reason": "unsupportedOS"]
        }

        // Generate a daily coaching insight on-device. `systemPrompt` is the
        // shared coach-voice instructions; `userPrompt` is the aggregated user
        // context. Resolves { title, message, focus }.
        AsyncFunction("generate") {
            (systemPrompt: String, userPrompt: String, promise: Promise) in
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                Task {
                    do {
                        let session = LanguageModelSession(instructions: systemPrompt)
                        let response = try await session.respond(
                            to: userPrompt,
                            generating: DailyCoaching.self
                        )
                        let coaching = response.content
                        promise.resolve([
                            "title":   coaching.title,
                            "message": coaching.message,
                            "focus":   coaching.focus.rawValue,
                        ])
                    } catch {
                        promise.reject("GENERATION_FAILED", error.localizedDescription)
                    }
                }
                return
            }
            #endif
            promise.reject("UNSUPPORTED", "On-device model requires iOS 26 and a compatible device")
        }

        // Best-effort: warm the model so the first real generation is faster.
        AsyncFunction("prewarm") { (promise: Promise) in
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                let session = LanguageModelSession()
                session.prewarm()
                promise.resolve(nil)
                return
            }
            #endif
            promise.resolve(nil)
        }
    }
}
