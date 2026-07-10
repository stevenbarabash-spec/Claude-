import SwiftUI

/// The Jarvis orb — a futuristic animated core that reflects what Jarvis is
/// doing: breathing when idle, reacting to your voice level while listening,
/// spinning while thinking, and rippling while speaking.
struct JarvisOrb: View {

    let state: JarvisViewModel.State
    /// Live microphone level 0…1 while listening.
    let audioLevel: CGFloat

    var body: some View {
        TimelineView(.animation) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            orb(time: t)
        }
    }

    @ViewBuilder
    private func orb(time t: TimeInterval) -> some View {
        let breathe = 0.04 * sin(t * 1.6)
        let speakPulse = state == .speaking ? 0.05 * sin(t * 9) : 0
        let voiceBoost = state == .listening ? audioLevel * 0.22 : 0
        let coreScale = 1.0 + breathe + speakPulse + voiceBoost

        ZStack {
            // Ambient glow.
            Circle()
                .fill(
                    RadialGradient(colors: [accent.opacity(0.55), accent.opacity(0.12), .clear],
                                   center: .center, startRadius: 10, endRadius: 150)
                )
                .scaleEffect(coreScale * 1.25)
                .blur(radius: 18)

            // Outer HUD tick ring, drifting slowly.
            Circle()
                .stroke(accent.opacity(0.35),
                        style: StrokeStyle(lineWidth: 2, dash: [2, 9]))
                .padding(6)
                .rotationEffect(.radians(t * 0.25))

            // Primary rotating gradient arc.
            Circle()
                .trim(from: 0, to: arcLength(t))
                .stroke(
                    AngularGradient(colors: [.clear, accent, secondary, accent.opacity(0.2)],
                                    center: .center),
                    style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                )
                .padding(18)
                .rotationEffect(.radians(t * primarySpeed))

            // Counter-rotating inner arc.
            Circle()
                .trim(from: 0, to: 0.55)
                .stroke(
                    AngularGradient(colors: [.clear, secondary.opacity(0.8), .clear],
                                    center: .center),
                    style: StrokeStyle(lineWidth: 1.5, lineCap: .round)
                )
                .padding(34)
                .rotationEffect(.radians(-t * (primarySpeed * 0.7)))

            // Speaking / listening ripples expanding outward.
            if state == .speaking || state == .listening {
                ForEach(0..<2, id: \.self) { index in
                    let phase = ((t * 0.55) + Double(index) * 0.5)
                        .truncatingRemainder(dividingBy: 1)
                    Circle()
                        .stroke(accent.opacity((1 - phase) * 0.5), lineWidth: 1.5)
                        .padding(40)
                        .scaleEffect(0.9 + phase * 0.55)
                }
            }

            // Core.
            Circle()
                .fill(
                    RadialGradient(colors: [.white,
                                            accent.opacity(0.9),
                                            secondary.opacity(0.75),
                                            Color(red: 0.02, green: 0.05, blue: 0.12)],
                                   center: UnitPoint(x: 0.42, y: 0.38),
                                   startRadius: 2, endRadius: 74)
                )
                .padding(52)
                .scaleEffect(coreScale)
                .shadow(color: accent.opacity(0.8), radius: 22)

            // Specular sheen sweeping the core.
            Circle()
                .fill(
                    AngularGradient(colors: [.clear, .white.opacity(0.28), .clear, .clear],
                                    center: .center)
                )
                .padding(52)
                .rotationEffect(.radians(t * 0.9))
                .blendMode(.plusLighter)
        }
        .animation(.easeInOut(duration: 0.35), value: state)
    }

    // MARK: - State styling

    private var accent: Color {
        switch state {
        case .idle: return .cyan
        case .listening: return Color(red: 0.35, green: 0.95, blue: 0.75)
        case .thinking: return Color(red: 0.55, green: 0.55, blue: 1.0)
        case .speaking: return .cyan
        }
    }

    private var secondary: Color {
        switch state {
        case .thinking: return .purple
        default: return .blue
        }
    }

    private var primarySpeed: Double {
        switch state {
        case .idle: return 0.5
        case .listening: return 0.9
        case .thinking: return 3.2
        case .speaking: return 0.9
        }
    }

    private func arcLength(_ t: TimeInterval) -> CGFloat {
        state == .thinking ? 0.3 + 0.2 * sin(t * 2.4) : 0.7
    }
}

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()
        JarvisOrb(state: .idle, audioLevel: 0)
            .frame(width: 260, height: 260)
    }
}
