import SwiftUI
import UIKit

/// Blue "digital rain" — dense columns of glyphs falling continuously.
///
/// Performance: glyphs are pre-rendered to images ONCE (text layout is the
/// expensive part), then the Canvas just blits images each frame at 24fps.
struct MatrixRainView: View {

    /// Overall strength of the effect.
    var intensity: Double = 0.4

    private static let glyphs: [Character] = Array("アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789Z$#*+<>=")
    private static let cell: CGFloat = 13

    // Pre-rendered glyph images: bright heads and blue tails.
    private static let tailImages: [Image] = glyphs.map {
        renderGlyph(String($0), color: UIColor(red: 0.25, green: 0.62, blue: 1.0, alpha: 1))
    }
    private static let headImages: [Image] = glyphs.map {
        renderGlyph(String($0), color: UIColor(red: 0.85, green: 1.0, blue: 1.0, alpha: 1))
    }

    private static func renderGlyph(_ glyph: String, color: UIColor) -> Image {
        let size = CGSize(width: 13, height: 16)
        let rendered = UIGraphicsImageRenderer(size: size).image { _ in
            (glyph as NSString).draw(
                at: .zero,
                withAttributes: [
                    .font: UIFont.monospacedSystemFont(ofSize: 12, weight: .semibold),
                    .foregroundColor: color,
                ])
        }
        return Image(uiImage: rendered)
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { timeline in
            Canvas { context, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                let columns = Int(size.width / Self.cell) + 1

                for column in 0..<columns {
                    let seed = Double(column) * 12.9898
                    let speed = 70 + 120 * Self.fract(sin(seed) * 43758.5453)
                    let trail = 12 + Int(14 * Self.fract(sin(seed * 1.7) * 9631.42))
                    let loop = Double(size.height) + Double(trail) * Double(Self.cell)
                    let headY = CGFloat(
                        (t * speed + Double(column) * 53.7).truncatingRemainder(dividingBy: loop)
                    )

                    for i in 0..<trail {
                        let y = headY - CGFloat(i) * Self.cell
                        guard y > -Self.cell, y < size.height + Self.cell else { continue }

                        // Glyphs mutate a few times per second.
                        let flicker = floor(t * 3) + Double(i * 31 + column * 17)
                        let index = Int(Self.fract(sin(flicker) * 4375.85) * Double(Self.glyphs.count - 1))

                        let fade = 1 - Double(i) / Double(trail)
                        context.opacity = i == 0 ? 0.95 : fade * 0.6
                        context.draw(
                            i == 0 ? Self.headImages[index] : Self.tailImages[index],
                            at: CGPoint(x: CGFloat(column) * Self.cell + Self.cell / 2, y: y)
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
