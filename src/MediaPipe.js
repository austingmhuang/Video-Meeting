import React, { useRef, useState, useCallback } from 'react'
import io from 'socket.io-client'
import faker from 'faker'
import { message as alertmessage } from 'antd'
import 'antd/dist/antd.css'

import {
  Input,
  Button,
  IconButton,
  Badge,
  Box,
  Paper,
  Typography,
} from '@material-ui/core'
import VideocamIcon from '@material-ui/icons/Videocam'
import VideocamOffIcon from '@material-ui/icons/VideocamOff'
import CallEndIcon from '@material-ui/icons/CallEnd'
import MicIcon from '@material-ui/icons/Mic'
import MicOffIcon from '@material-ui/icons/MicOff'
import ScreenShareIcon from '@material-ui/icons/ScreenShare'
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare'
import ChatIcon from '@material-ui/icons/Chat'

import Modal from 'react-bootstrap/Modal'
import 'bootstrap/dist/css/bootstrap.css'
import { Row } from 'reactstrap'

import { Holistic } from '@mediapipe/holistic'
import * as holis from '@mediapipe/holistic'
import * as cam from '@mediapipe/camera_utils'

import { useDropzone } from 'react-dropzone'

/*
// mediapipe code

const holistic = new Holistic({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
    },
});

holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: true,
    smoothSegmentation: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});

holistic.onResults(onResults);
camera = new cam.Camera(localVideoref.current.video, {
    onFrame: async() => {
        await holistic.send({ image: localVideoref.current.video })
    },
    width: 640,
    height: 480
})

camera.start()
*/

const server_url =
  process.env.NODE_ENV === 'production'
    ? 'https://video.sebastienbiollo.com'
    : 'http://localhost:4001'

var connections = {}
const peerConnectionConfig = {
  iceServers: [
    // { 'urls': 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
}
var socket = null
var socketId = null
var elms = 0

export default function MediaPipe() {
  const localVideoref = useRef(null)
  const canvasRef = useRef(null)

  const [isDrop, setDrop] = useState(false)
  const [filename, setFileName] = useState('')

  const onDrop = useCallback(
    (acceptedFiles) => {
      setDrop(true)
      setFileName(acceptedFiles[0].name)
    },
    [filename]
  )

  const accept = '.vrm'

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    onDrop,
  })

  // variables for mediapipe
  const mediapipeconnect = window.drawConnectors
  const mediapipeland = window.drawLandmarks
  let camera = null

  const [videoAvailable, setVideoAvailable] = useState(false)
  const [audioAvailable, setAudioAvailable] = useState(false)

  const [video, setVideo] = useState(false)
  const [audio, setAudio] = useState(false)
  const [screen, setScreen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [screenAvailable, setScreenAvailable] = useState(true)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [newmessages, setNewmessages] = useState(0)
  const [askForUsername, setAskUsername] = useState(true)
  const [username, setUsername] = useState(faker.internet.userName())

  let connections = {}

  const getMediaPipe = (videoElement) => {
    const holistic = new Holistic({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
      },
    })

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: true,
      smoothSegmentation: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    holistic.onResults(onResults)
    camera = new cam.Camera(videoElement, {
      onFrame: async () => {
        await holistic.send({ image: videoElement })
      },
      width: 640,
      height: 480,
    })

    camera.start()
  }

  const getPermissions = async () => {
    try {
      await navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(() => {
          setVideoAvailable(true)
        })
        .catch(() => {
          setVideoAvailable(false)
        })

      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => {
          setAudioAvailable(true)
        })
        .catch(() => {
          setAudioAvailable(false)
        })

      if (videoAvailable || audioAvailable) {
        navigator.mediaDevices
          .getUserMedia({ video: videoAvailable, audio: audioAvailable })
          .then((stream) => {
            window.localStream = stream
            localVideoref.current.srcObject = stream
            return localVideoref.current
          })
          .then(async (videoElement) => {
            getMediaPipe(videoElement)
          })
          .catch((e) => console.log(e))
      }
    } catch (e) {
      console.log(e)
    }
  }

  getPermissions()

  const getMedia = () => {
    setVideo(videoAvailable)
    setAudio(audioAvailable)

    getUserMedia()
    connectToSocketServer()
  }

  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .then((videoElement) => {
          getMediaPipe(videoElement)
        })
        .catch((e) => {
          console.log(e)
        })
    } else {
      try {
        let tracks = localVideoref.current.srcObject.getTracks()
        tracks.forEach((track) => track.stop())
      } catch (e) {}
    }
  }

  const getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop())
    } catch (e) {
      console.log(e)
    }

    window.localStream = stream
    localVideoref.current.srcObject = stream

    for (let id in connections) {
      if (id === socketId) continue

      connections[id].addStream(window.localStream)
      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socket.emit(
              'signal',
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            )
          })
          .catch((e) => {
            console.log(e)
          })
      })
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false)
        setAudio(false)

        try {
          let tracks = localVideoref.current.srcObject.getTracks()
          tracks.forEach((track) => track.stop())
        } catch (e) {
          console.log(e)
        }

        let blackSilence = (...args) => {
          return new MediaStream([black(...args), silence()])
        }
        window.localStream = blackSilence()
        localVideoref.current.srcObject = window.localStream

        for (let id in connections) {
          connections[id].addStream(window.localStream)

          connections[id].createOffer().then((description) => {
            connections[id]
              .setLocalDescription(description)
              .then(() => {
                socket.emit(
                  'signal',
                  id,
                  JSON.stringify({ sdp: connections[id].localDescription })
                )
              })
              .catch((e) => console.log(e))
          })
        }
      }
    })

    return localVideoref.current
  }

  const getDisplayMedia = () => {
    if (screen) {
      navigator.mediaDevices
        .getDisplayMedia({ video: true, audio: true })
        .then(getDisplayMediaSuccess)
        .then((videoElement) => {
          getMediaPipe(videoElement)
        })
        .catch((e) => console.log(e))
    }
  }

  const getDisplayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => {
        track.stop()
      })
    } catch (e) {
      console.log(e)
    }

    window.localStream = stream
    localVideoref.current.srcObject = stream

    for (let id in connections) {
      if (id === socketId) continue

      connections[id].addStream(window.localStream)

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socket.emit(
              'signal',
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            )
          })
          .catch((e) => console.log(e))
      })
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setScreen(false)

        try {
          let tracks = localVideoref.current.srcObject.getTracks()
          tracks.forEach((track) => {
            track.stop()
          })
        } catch (e) {
          console.log(e)
        }

        let blackSilence = (...args) => {
          return new MediaStream([black(...args), silence()])
        }

        window.localStream = blackSilence()
        localVideoref.current.srcObject = window.localStream

        getUserMedia()
      }
    })

    return localVideoref.current
  }

  const gotMessageFromServer = (fromId, message) => {
    let signal = JSON.parse(message)

    if (fromId !== socketId) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === 'offer') {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socket.emit(
                        'signal',
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        })
                      )
                    })
                    .catch((e) => console.log(e))
                })
                .catch((e) => {
                  console.log(e)
                })
            }
          })
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e))
      }
    }
  }

  const changeCssVideos = (main) => {
    let widthMain = main.offsetWidth
    let minWidth = '30%'
    if ((widthMain * 30) / 100 < 300) {
      minWidth = '300px'
    }
    let minHeight = '40%'

    let height = String(100 / elms) + '%'
    let width = ''

    if (elms === 0 || elms === 1) {
      width = '100%'
      height = '100%'
    } else if (elms === 2) {
      width = '45%'
      height = '100%'
    } else if (elms === 3 || elms === 4) {
      width = '35%'
      height = '50%'
    } else {
      width = String(100 / elms) + '%'
    }

    let videos = main.querySelectorAll('video')
    for (let a = 0; a < videos.length; ++a) {
      videos[a].style.minWidth = minWidth
      videos[a].style.minHeight = minHeight
      videos[a].style.setProperty('width', width)
      videos[a].style.setProperty('height', height)
    }

    let canvases = main.querySelectorAll('canvas')
    for (let a = 0; a < canvases.length; ++a) {
      canvases[a].style.minWidth = minWidth
      canvases[a].style.minHeight = minHeight
      canvases[a].style.setProperty('width', width)
      canvases[a].style.setProperty('height', height)
    }

    return { minWidth, minHeight, width, height }
  }

  const connectToSocketServer = () => {
    socket = io.connect(server_url, { secure: true })

    socket.on('signal', gotMessageFromServer)

    socket.on('connect', () => {
      socket.emit('join-call', window.location.href)
      socketId = socket.id
      socket.on('chat-message', addMessage)

      socket.on('user-left', (id) => {
        let video = document.querySelector(`[data-socket="${id}"]`)
        if (video !== null) {
          elms--
          video.parentNode.removeChild(video)

          let main = document.getElementById('main')
          changeCssVideos(main)
        }
      })

      socket.on('user-joined', (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(
            peerConnectionConfig
          )
          // wait for their ice candidates
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socket.emit(
                'signal',
                socketListId,
                JSON.stringify({ ice: event.candidate })
              )
            }
          }

          // wait for their video stream
          connections[socketListId].onaddstream = (event) => {
            let searchVidep = document.querySelector(
              `[data-socket="${socketListId}"]`
            )
            if (searchVidep !== null) {
              searchVidep.srcObject = event.stream
            } else {
              elms = clients.length
              let main = document.getElementById('main')
              let cssMesure = changeCssVideos(main)

              let video = document.createElement('video')
              let css = {
                minWidth: cssMesure.minWidth,
                minHeight: cssMesure.minHeight,
                maxHeight: '100%',
                margin: '10px',
                borderStyle: 'solid',
                borderColor: '#bdbdbd',
                objectFit: 'fill',
              }

              for (let i in css) video.style[i] = css[i]
              video.style.setProperty('width', cssMesure.width)
              video.style.setProperty('height', cssMesure.height)
              video.setAttribute('data-socket', socketListId)
              video.srcObject = event.stream
              video.autoplay = true
              video.playsinline = true

              main.appendChild(video)
            }
          }

          // add the local video stream
          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream)
          } else {
            let blackSilence = (...args) => {
              return new MediaStream([black(...args), silence()])
            }

            window.localStream = blackSilence()
            connections[socketListId].addStream(window.localStream)
          }
        })

        if (id === socketId) {
          for (let id2 in connections) {
            if (id2 === socketId) continue

            try {
              connections[id2].addStream(window.localStream)
            } catch (e) {}

            connections[id2].createOffer().then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  socket.emit(
                    'signal',
                    id2,
                    JSON.stringify({ sdp: connections[id2].localDescription })
                  )
                })
                .catch((e) => console.log(e))
            })
          }
        }
      })
    })
  }

  const black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement('canvas'), {
      width,
      height,
    })
    canvas.getContext('2d').fillRect(0, 0, width, height)
    let stream = canvas.captureStream()
    return Object.assign(stream.getVideoTracks()[0], { enabled: false })
  }

  const silence = () => {
    let ctx = new AudioContext()
    let oscillator = ctx.createOscillator()
    let dst = oscillator.connect(ctx.createMediaStreamDestination())
    oscillator.start()
    ctx.resume()
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
  }

  const handleVideo = () => {
    setVideo(!video)
    getUserMedia()
  }
  const handleAudio = () => {
    setVideo(!audio)
    getUserMedia()
  }
  const handleScreen = () => {
    setScreen(!screen)
    getDisplayMedia()
  }

  const handleEndCall = () => {
    try {
      let tracks = localVideoref.current.srcObject.getTracks()
      tracks.forEach((track) => {
        track.stop()
      })
    } catch (e) {}

    window.location.href = '/'
  }

  const openChat = () => {
    setShowModal(true)
    setNewmessages(0)
  }

  const closeChat = () => {
    setShowModal(false)
  }

  const handleMessage = (e) => {
    setMessage(e.target.value)
  }

  const addMessage = (data, sender, socketIdSender) => {
    let target = { sender: sender, data: data }
    setMessages([...messages, target])

    if (socketIdSender !== socketId) {
      setNewmessages(newmessages + 1)
    }
  }

  const handleUsername = (e) => {
    setUsername(e.target.value)
  }

  const sendMessage = () => {
    socket.emit('chat-message', message, username)
    setMessage('')
  }

  const copyUrl = () => {
    let text = window.location.href

    if (!navigator.clipboard) {
      let textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      try {
        document.execCommand('copy')
        alertmessage.success('Link copied to clipboard')
      } catch (err) {
        alertmessage.error('Failed to copy')
      }

      document.body.removeChild(textArea)
      return
    }

    navigator.clipboard.writeText(text).then(
      function () {
        alertmessage.success('Link copied to clipboard')
      },
      () => {
        alertmessage.error('Failed to copy')
      }
    )
  }

  const connect = () => {
    setAskUsername(false)
    getMedia()
  }

  const isChrome = function () {
    let userAgent = (navigator && (navigator.userAgent || '')).toLowerCase()
    let vendor = (navigator && (navigator.vendor || '')).toLowerCase()
    let matchChrome = /google inc/.test(vendor)
      ? userAgent.match(/(?:chrome|crios)\/(\d+)/)
      : null
    // let matchFirefox = userAgent.match(/(?:firefox|fxios)\/(\d+)/)
    // return matchChrome !== null || matchFirefox !== null
    return matchChrome !== null
  }

  // for mediapipe
  function onResults(results) {
    const canvasElement = canvasRef.current
    const canvasCtx = canvasElement.getContext('2d')
    canvasCtx.save()

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height)
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    )

    mediapipeconnect(canvasCtx, results.poseLandmarks, holis.POSE_CONNECTIONS, {
      color: '#00FF00',
      lineWidth: 4,
    })
    mediapipeland(canvasCtx, results.poseLandmarks, {
      color: '#FF0000',
      lineWidth: 2,
    })
    mediapipeconnect(
      canvasCtx,
      results.faceLandmarks,
      holis.FACEMESH_TESSELATION,
      {
        color: '#C0C0C070',
        lineWidth: 1,
      }
    )
    mediapipeconnect(
      canvasCtx,
      results.leftHandLandmarks,
      holis.HAND_CONNECTIONS,
      {
        color: '#CC0000',
        lineWidth: 5,
      }
    )
    mediapipeland(canvasCtx, results.leftHandLandmarks, {
      color: '#00FF00',
      lineWidth: 2,
    })
    mediapipeconnect(
      canvasCtx,
      results.rightHandLandmarks,
      holis.HAND_CONNECTIONS,
      {
        color: '#00CC00',
        lineWidth: 5,
      }
    )
    mediapipeland(canvasCtx, results.rightHandLandmarks, {
      color: '#FF0000',
      lineWidth: 2,
    })
    canvasCtx.restore()
  }

  if (isChrome() === false) {
    return (
      <div
        style={{
          background: 'white',
          width: '30%',
          height: 'auto',
          padding: '20px',
          minWidth: '400px',
          textAlign: 'center',
          margin: 'auto',
          marginTop: '50px',
          justifyContent: 'center',
        }}
      >
        <h1>Sorry, this works only with Google Chrome</h1>
      </div>
    )
  }

  return (
    <div>
      {askForUsername === true ? (
        <div>
          <div
            style={{
              background: 'white',
              width: '30%',
              height: 'auto',
              padding: '20px',
              minWidth: '400px',
              textAlign: 'center',
              margin: 'auto',
              marginTop: '50px',
              justifyContent: 'center',
            }}
          >
            <p style={{ margin: 0, fontWeight: 'bold', paddingRight: '50px' }}>
              Set your username
            </p>
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => handleUsername(e)}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={connect}
              style={{ margin: '20px' }}
            >
              Connect
            </Button>
          </div>
          <div
            style={{
              justifyContent: 'center',
              textAlign: 'center',
              paddingTop: '40px',
            }}
          >
            <Box width={180} height={180}>
              <Paper
                variant="outlined"
                square
                {...getRootProps()}
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 10,
                }}
              >
                <input {...getInputProps()} />
                {!isDrop ? (
                  isDragActive ? (
                    <Typography>Drop the files here ...</Typography>
                  ) : (
                    <Typography>
                      Drag 1 drop some file here, or click to select 1 file
                    </Typography>
                  )
                ) : (
                  <Typography>{filename}</Typography>
                )}
              </Paper>
            </Box>
          </div>
          <div
            style={{
              justifyContent: 'center',
              textAlign: 'center',
              paddingTop: '40px',
            }}
          >
            <video
              id="my-video"
              ref={localVideoref}
              autoPlay
              muted
              style={{
                borderStyle: 'solid',
                borderColor: '#bdbdbd',
                objectFit: 'fill',
                width: '60%',
                height: '30%',
              }}
            ></video>
          </div>
          <div
            style={{
              justifyContent: 'center',
              textAlign: 'center',
              paddingTop: '40px',
            }}
          >
            <canvas
              id="my-canvas"
              ref={canvasRef}
              style={{
                borderStyle: 'solid',
                borderColor: '#bdbdbd',
                objectFit: 'fill',
                width: '60%',
                height: '30%',
              }}
            ></canvas>
          </div>
        </div>
      ) : (
        <div>
          <div
            className="btn-down"
            style={{
              backgroundColor: 'whitesmoke',
              color: 'whitesmoke',
              textAlign: 'center',
            }}
          >
            <IconButton style={{ color: '#424242' }} onClick={handleVideo}>
              {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            <IconButton style={{ color: '#f44336' }} onClick={handleEndCall}>
              <CallEndIcon />
            </IconButton>

            <IconButton style={{ color: '#424242' }} onClick={handleAudio}>
              {audio === true ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            {screenAvailable === true ? (
              <IconButton style={{ color: '#424242' }} onClick={handleScreen}>
                {screen === true ? (
                  <ScreenShareIcon />
                ) : (
                  <StopScreenShareIcon />
                )}
              </IconButton>
            ) : null}

            <Badge
              badgeContent={newmessages}
              max={999}
              color="secondary"
              onClick={openChat}
            >
              <IconButton style={{ color: '#424242' }} onClick={openChat}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>
          <Modal
            show={showModal}
            onHide={closeChat}
            style={{ zIndex: '999999' }}
          >
            <Modal.Header closeButton>
              <Modal.Title>Chat Room</Modal.Title>
            </Modal.Header>
            <Modal.Body
              style={{
                overflow: 'auto',
                overflowY: 'auto',
                height: '400px',
                textAlign: 'left',
              }}
            >
              {messages.length > 0 ? (
                messages.map((item, index) => (
                  <div key={index} style={{ textAlign: 'left' }}>
                    <p style={{ wordBreak: 'break-all' }}>
                      <b>{item.sender}</b>: {item.data}
                    </p>
                  </div>
                ))
              ) : (
                <p>No message yet</p>
              )}
            </Modal.Body>
            <Modal.Footer className="div-send-msg">
              <Input
                placeholder="Message"
                value={message}
                onChange={(e) => handleMessage(e)}
              />
              <Button variant="contained" color="primary" onClick={sendMessage}>
                Send
              </Button>
            </Modal.Footer>
          </Modal>
          <div className="container">
            <div style={{ paddingTop: '20px' }}>
              <Input value={window.location.href} disabled={true}></Input>
              <Button
                style={{
                  backgroundColor: '#3f51b5',
                  color: 'whitesmoke',
                  marginLeft: '20px',
                  marginTop: '10px',
                  width: '120px',
                  fontSize: '10px',
                }}
                onClick={copyUrl}
              >
                Copy invite link
              </Button>
            </div>

            <Row
              id="main"
              className="flex-container"
              style={{ margin: 0, padding: 0 }}
            >
              <video
                id="my-video"
                ref={localVideoref}
                autoPlay
                muted
                style={{
                  borderStyle: 'solid',
                  borderColor: '#bdbdbd',
                  margin: '10px',
                  objectFit: 'fill',
                  width: '100%',
                  height: '100%',
                }}
              ></video>
            </Row>
          </div>
        </div>
      )}
    </div>
  )
}
