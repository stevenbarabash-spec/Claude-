import SwiftUI

/// Blue "digital rain" — columns of glyphs falling continuously behind the
/// orb. Pure Canvas drawing, deterministic per-column randomness (no stored
/// state), throttled to 24fps to stay easy on the battery.
struct MatrixRainView: View {

    /// Overall strength of the effect; the home screen passes something
    /// subtle so the orb stays the hero.
    var intensity: Double = 0.4

    private static let glyphs = Array("アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789Z$#*+=<>")

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                let cell: CGFloat = 16
                let columns = Int(size.width / cell) + 1

                for column in 0..<columns {
                    let seed = Double(column) * 12.9898
                    let speed = 55 + 95 * Self.fract(sin(seed) * 43758.5453)
                    let trail = 10 + Int(12 * Self.fract(sin(seed * 1.7) * 9631.42))
                    let loop = size.height + CGFloat(trail) * cell
                    let headY = CGFloat(
                        (t * speed + Double(column) * 53.7).truncatingRemainder(dividingBy: loop)
                    )

                    for i in 0..<trail {
                        let y = headY - CGFloat(i) * cell
                        guard y > -cell, y < size.height + cell else { continue }

                        // Glyphs mutate a few times per second, like the movie.
                        let flicker = floor(t * 7) + Double(i * 31 + column * 17)
                        let pick = Self.fract(sin(flicker) * 4375.85)
                        let glyph = Self.glyphs[Int(pick * Double(Self.glyphs.count - 1))]

                        let fade = 1 - Double(i) / Double(trail)
                        let color: Color = i == 0
                            ? Color(red: 0.8, green: 1.0, blue: 1.0).opacity(0.95)
                            : Color(red: 0.15, green: 0.6, blue: 1.0).opacity(fade * 0.55)

                        context.draw(
                            Text(String(glyph))
                                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                .foregroundColor(color),
                            at: CGPoint(x: CGFloat(column) * cell + cell / 2, y: y)
                        )
                    }
                }
            }
        }
        .opacity(intensity)
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }

    private static func fract(_ x: Double) -> Double { x - floor(x) }
}

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()
        MatrixRainView(intensity: 0.6)
    }
}
