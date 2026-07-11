import SwiftUI

/// The Jarvis arc reactor — a hollow, luminous core (no solid ball) with
/// rotating arcs, spokes, and orbiting sparks.
///
/// Performance: no per-frame blurs or shadows (those killed the GPU in v1);
/// glow comes from pre-computed radial gradients, the whole stack is
/// flattened with drawingGroup(), and updates are capped at 30fps.
struct JarvisOrb: View {

    let state: JarvisViewModel.State
    /// Live microphone level 0…1 while listening.
    let audioLevel: CGFloat

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            orb(time: timeline.date.timeIntervalSinceReferenceDate)
        }
    }

    @ViewBuilder
    private func orb(time t: TimeInterval) -> some View {
        let breathe = 0.03 * sin(t * 1.6)
        let speakPulse = state == .speaking ? 0.05 * sin(t * 9) : 0
        let voiceBoost = state == .listening ? audioLevel * 0.2 : 0
        let coreScale = 1.0 + breathe + speakPulse + voiceBoost

        ZStack {
            // Ambient halo — a soft gradient, no blur needed.
            Circle()
                .fill(
                    RadialGradient(colors: [accent.opacity(0.35), accent.opacity(0.08), .clear],
                                   center: .center, startRadius: 30, endRadius: 135)
                )
                .scaleEffect(coreScale * 1.15)

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

            // Ripples while speaking or listening.
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

            // Reactor rim — bright ring around a translucent core.
            Circle()
                .strokeBorder(
                    AngularGradient(colors: [accent, .white.opacity(0.9), accent, secondary, accent],
                                    center: .center),
                    lineWidth: 4
                )
                .padding(58)
                .scaleEffect(coreScale)

            // Hollow energy center — see-through, not a solid ball.
            Circle()
                .fill(
                    RadialGradient(colors: [.white.opacity(0.55),
                                            accent.opacity(0.35),
                                            accent.opacity(0.1),
                                            .clear],
                                   center: .center, startRadius: 2, endRadius: 78)
                )
                .padding(62)
                .scaleEffect(coreScale)

            // Rotating inner spokes.
            ForEach(0..<3, id: \.self) { k in
                Circle()
                    .trim(from: 0, to: 0.1)
                    .stroke(accent.opacity(0.85),
                            style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .padding(76)
                    .rotationEffect(.radians(t * 1.3 + Double(k) * (2 * .pi / 3)))
            }

            // Orbiting sparks.
            ForEach(0..<3, id: \.self) { k in
                let angle = t * (0.9 + 0.3 * Double(k)) + Double(k) * 2.1
                Circle()
                    .fill(k == 0 ? Color.white : accent)
                    .frame(width: 5, height: 5)
                    .offset(x: cos(angle) * 96, y: sin(angle) * 96)
                    .opacity(0.9)
            }
        }
        .drawingGroup()
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
            .frame(width: 270, height: 270)
    }
}
