import AppKit
import AVFoundation
import CoreVideo

let width = 1080
let height = 1920
let fps: Int32 = 30
let durationSeconds = 8

func makeReel(input: String, output: String) throws {
    guard let image = NSImage(contentsOfFile: input),
          let source = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        throw NSError(domain: "MekivoReels", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not load \(input)"])
    }

    try? FileManager.default.removeItem(atPath: output)
    let writer = try AVAssetWriter(outputURL: URL(fileURLWithPath: output), fileType: .mp4)
    let settings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: 5_000_000,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
        ]
    ]
    let inputWriter = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    inputWriter.expectsMediaDataInRealTime = false
    let attributes: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
    ]
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: inputWriter, sourcePixelBufferAttributes: attributes)
    guard writer.canAdd(inputWriter) else { throw NSError(domain: "MekivoReels", code: 2) }
    writer.add(inputWriter)
    guard writer.startWriting() else { throw writer.error ?? NSError(domain: "MekivoReels", code: 3) }
    writer.startSession(atSourceTime: .zero)

    let totalFrames = Int(fps) * durationSeconds
    for frame in 0..<totalFrames {
        while !inputWriter.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
        guard let pool = adaptor.pixelBufferPool else { throw NSError(domain: "MekivoReels", code: 4) }
        var optionalBuffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, pool, &optionalBuffer)
        guard let buffer = optionalBuffer else { throw NSError(domain: "MekivoReels", code: 5) }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

        let context = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer),
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        )!
        context.setFillColor(NSColor.black.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))

        let progress = CGFloat(frame) / CGFloat(max(1, totalFrames - 1))
        let scale = 1.0 + (0.055 * progress)
        let baseScale = max(CGFloat(width) / CGFloat(source.width), CGFloat(height) / CGFloat(source.height))
        let drawWidth = CGFloat(source.width) * baseScale * scale
        let drawHeight = CGFloat(source.height) * baseScale * scale
        let drift = 18.0 * progress
        let rect = CGRect(x: (CGFloat(width) - drawWidth) / 2.0, y: (CGFloat(height) - drawHeight) / 2.0 - drift, width: drawWidth, height: drawHeight)
        context.interpolationQuality = .high
        context.draw(source, in: rect)

        let fadeIn = min(1.0, progress / 0.04)
        let fadeOut = min(1.0, (1.0 - progress) / 0.07)
        let visibility = min(fadeIn, fadeOut)
        if visibility < 1.0 {
            context.setFillColor(NSColor.black.withAlphaComponent(1.0 - visibility).cgColor)
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        }

        let time = CMTime(value: Int64(frame), timescale: fps)
        if !adaptor.append(buffer, withPresentationTime: time) {
            throw writer.error ?? NSError(domain: "MekivoReels", code: 6)
        }
    }

    inputWriter.markAsFinished()
    let semaphore = DispatchSemaphore(value: 0)
    writer.finishWriting { semaphore.signal() }
    semaphore.wait()
    if writer.status != .completed { throw writer.error ?? NSError(domain: "MekivoReels", code: 7) }
}

let root = FileManager.default.currentDirectoryPath
let jobs = [
    ("public/ads/wrong-part-v1.jpg", "public/ads/wrong-part-reel-v1.mp4"),
    ("public/ads/car-search-v1.jpg", "public/ads/car-search-reel-v1.mp4"),
    ("public/ads/part-number-v1.jpg", "public/ads/part-number-reel-v1.mp4")
]

for (input, output) in jobs {
    try makeReel(input: root + "/" + input, output: root + "/" + output)
    print("Created \(output)")
}
