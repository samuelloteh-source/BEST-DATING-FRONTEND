const app = require('./backend')
const http = require('http')
const PORT = Number(process.env.PORT || 3001)

const server = http.createServer(app)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Custom backend running on http://0.0.0.0:${PORT}`)
})
