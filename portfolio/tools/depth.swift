// usage: swift depth.swift <model.mlpackage> <photo> <outdir>
// Writes: depth.png (near = white), matte.png (person), color.png — all at the photo's resolution.
import Foundation
import CoreML
import CoreImage
import Vision

let a = CommandLine.arguments
let pkg = URL(fileURLWithPath: a[1]), photo = URL(fileURLWithPath: a[2]), out = URL(fileURLWithPath: a[3])
let ctx = CIContext()
let gray = CGColorSpace(name: CGColorSpace.linearGray)!
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!

let compiled = try MLModel.compileModel(at: pkg)
let model = try MLModel(contentsOf: compiled)
for (k, d) in model.modelDescription.inputDescriptionsByName { print("IN", k, d) }
for (k, d) in model.modelDescription.outputDescriptionsByName { print("OUT", k, d) }

guard var src = CIImage(contentsOf: photo) else { fatalError("cannot read photo") }
// optional crop: x y w h in top-left pixel coordinates (matches the model's 518x392 landscape frame best)
if a.count >= 8, let x = Double(a[4]), let y = Double(a[5]), let w = Double(a[6]), let h = Double(a[7]) {
  let H0 = src.extent.height
  src = src.cropped(to: CGRect(x: x, y: H0 - y - h, width: w, height: h))
  src = src.transformed(by: CGAffineTransform(translationX: -src.extent.origin.x, y: -src.extent.origin.y))
}
let W = src.extent.width, H = src.extent.height
try ctx.writePNGRepresentation(of: src, to: out.appendingPathComponent("color.png"), format: .RGBA8, colorSpace: srgb)

// --- depth: Vision handles resizing to the model's input
let vnModel = try VNCoreMLModel(for: model)
let req = VNCoreMLRequest(model: vnModel)
req.imageCropAndScaleOption = .scaleFill
try VNImageRequestHandler(ciImage: src).perform([req])
var depthImg: CIImage? = nil
if let r = req.results?.first as? VNPixelBufferObservation {
  depthImg = CIImage(cvPixelBuffer: r.pixelBuffer)
} else if let r = req.results?.first as? VNCoreMLFeatureValueObservation, let arr = r.featureValue.multiArrayValue {
  print("multiarray", arr.shape)
}
guard var dimg = depthImg else { fatalError("no depth output") }
print("depth raw", dimg.extent)
// normalise to 0..1 using min/max
let mm = CIFilter(name: "CIAreaMinMax", parameters: [kCIInputImageKey: dimg, kCIInputExtentKey: CIVector(cgRect: dimg.extent)])!.outputImage!
var px = [Float](repeating: 0, count: 8)
ctx.render(mm, toBitmap: &px, rowBytes: 32, bounds: CGRect(x: 0, y: 0, width: 2, height: 1), format: .RGBAf, colorSpace: nil)
let lo = px[0], hi = px[4]
print("depth range", lo, hi)
let scale = 1 / max(1e-6, hi - lo)
dimg = dimg.applyingFilter("CIColorMatrix", parameters: [
  "inputRVector": CIVector(x: CGFloat(scale), y: 0, z: 0, w: 0),
  "inputGVector": CIVector(x: CGFloat(scale), y: 0, z: 0, w: 0),
  "inputBVector": CIVector(x: CGFloat(scale), y: 0, z: 0, w: 0),
  "inputBiasVector": CIVector(x: CGFloat(-lo * scale), y: CGFloat(-lo * scale), z: CGFloat(-lo * scale), w: 0),
])
dimg = dimg.transformed(by: CGAffineTransform(scaleX: W / dimg.extent.width, y: H / dimg.extent.height)).cropped(to: src.extent)
try ctx.writePNGRepresentation(of: dimg, to: out.appendingPathComponent("depth.png"), format: .L8, colorSpace: gray)

// --- person matte (Apple Vision)
let seg = VNGeneratePersonSegmentationRequest()
seg.qualityLevel = .accurate
seg.outputPixelFormat = kCVPixelFormatType_OneComponent8
try VNImageRequestHandler(ciImage: src).perform([seg])
if let m = seg.results?.first?.pixelBuffer {
  var mi = CIImage(cvPixelBuffer: m)
  mi = mi.transformed(by: CGAffineTransform(scaleX: W / mi.extent.width, y: H / mi.extent.height))
  try ctx.writePNGRepresentation(of: mi, to: out.appendingPathComponent("matte.png"), format: .L8, colorSpace: gray)
  print("matte ok")
}
print("DONE", Int(W), Int(H))
