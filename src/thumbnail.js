/**
 * @Params
 * ProgressEvent and self (state)
 * 
 * @Return void
 * 
 * Function serves to turn a VRM file into a cropped thumbnail image URL. 
 */

const LE = true // Binary GLTF is little endian.
const MAGIC_glTF = 0x676c5446
const GLB_FILE_HEADER_SIZE = 12
const GLB_CHUNK_LENGTH_SIZE = 4
const GLB_CHUNK_TYPE_SIZE = 4
const GLB_CHUNK_HEADER_SIZE = GLB_CHUNK_LENGTH_SIZE + GLB_CHUNK_TYPE_SIZE
const GLB_CHUNK_TYPE_JSON = 0x4e4f534a
const GLB_CHUNK_TYPE_BIN = 0x004e4942

function getMagic(dataView) {
  const offset = 0
  return dataView.getUint32(offset)
}

function getVersion(dataView) {
  const offset = 4
  let version = dataView.getUint32(offset, LE)
  return version
}

function getTotalLength(dataView) {
  const offset = 8
  let length = dataView.getUint32(offset, LE)
  return length
}

function getGLBMeta(dataView) {
  let magic = getMagic(dataView)
  let version = getVersion(dataView)
  let total = getTotalLength(dataView)

  return {
    magic: magic,
    version: version,
    total: total,
  }
}

function getJsonData(dataView) {
  const offset = GLB_FILE_HEADER_SIZE

  let chunkLength = dataView.getUint32(offset, LE)
  console.log('ChunkLen ' + chunkLength)

  let chunkType = dataView.getUint32(offset + GLB_CHUNK_LENGTH_SIZE, LE)
  console.log('ChunkType ' + chunkType.toString(16))

  if (chunkType !== GLB_CHUNK_TYPE_JSON) {
    console.warn("This GLB file doesn't have a JSON part.")
    return
  }

  const jsonChunk = new Uint8Array(
    dataView.buffer,
    offset + GLB_CHUNK_HEADER_SIZE,
    chunkLength
  )
  const decoder = new TextDecoder('utf8')
  const jsonText = decoder.decode(jsonChunk)
  const json = JSON.parse(jsonText)
  console.log(json)

  return {
    json: json,
    length: chunkLength,
  }
}

function getThumbnail(jsonData, buffer, offset) {
  let index = -1
  let mimeType = ''

  for (var i = 0; i < jsonData.json.images.length; i++) {
    if (jsonData.json.images[i].name === 'Thumbnail') {
      index = jsonData.json.images[i].bufferView
      mimeType = jsonData.json.images[i].mimeType
      break
    }
  }

  if (index === -1) {
    console.warn('Thumbnail field was not found.')
    return
  }

  const view = jsonData.json.bufferViews[index]
  let imgBuf = new Uint8Array(
    buffer,
    offset + GLB_CHUNK_HEADER_SIZE + view.byteOffset,
    view.byteLength
  )

  return URL.createObjectURL(new Blob([imgBuf]))
}

export default function onLoadHandler(e, self) {
  let raw = e.target.result
  let ds = new DataView(raw)

  let glbMeta = getGLBMeta(ds)
  console.log('magic ' + glbMeta.magic.toString(16))
  if (glbMeta.magic !== MAGIC_glTF) {
    console.warn('This file is not a GLB file.')
    return
  }
  console.log('Version ' + glbMeta.version)
  console.log('Total Length ' + glbMeta.total)

  const jsonData = getJsonData(ds)
  const offset = GLB_FILE_HEADER_SIZE + GLB_CHUNK_HEADER_SIZE + jsonData.length
  let dataChunkType = ds.getUint32(offset + GLB_CHUNK_LENGTH_SIZE, LE)

  if (dataChunkType !== GLB_CHUNK_TYPE_BIN) {
    console.warn("This GLB file doesn't have a binary buffer.")
    return
  }

  self.setState({imagePreviewUrl: getThumbnail(jsonData, ds.buffer, offset)})
}
