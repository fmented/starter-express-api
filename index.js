const dotenv = require("dotenv").config()
const express = require('express')
const cors = require("cors")
const nodemailer = require("nodemailer")
const ash = require('express-async-handler')
var bodyParser = require('body-parser');
const app = express()

const { default: bufferToDataUrl } = require("buffer-to-data-url")

app.use(cors({
  methods: ["POST"],
  preflightContinue: true
}))


app.use(bodyParser.raw({ limit: '2000kb', type: 'application/pdf' }));


const email = process.env.EMAIL_USER
const pw = process.env.EMAIL_PASSWORD


const transport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: email,
    pass: pw
  },
})


async function sendMail({ to, name, as = "e-Ticket" }, pdf) {

  return await transport.sendMail({
    from: "Loudeast Media",
    to: to,
    text: `Hi ${name}, 
      Lampiran dibawah ini adalah ${as} ${process.env.EVENT_NAME} kamu.
          Kami sarankan untuk tidak menunjukkan ${as} kamu kepada siapapun sebelum acara.
  
          See you at the venue.
          `,
    html: `<!DOCTYPE html><html><head><title>${as}</title></head><body><h1>Hi ${name},<h1><br/><p>Lampiran dibawah ini adalah ${as} ${process.env.EVENT_NAME} kamu</p><strong>Kami sarankan untuk tidak menunjukkan ${as} kamu kepada siapapun sebelum acara.</strong><br/><br/><p>See you at the venue.</p></body></html>`
    ,
    subject: `${as} ${process.env.EVENT_NAME}`,
    attachments: [
      {
        href: pdf,
        filename: `${as}.pdf`
      }
    ]


  })
}


app.post('/bundlingpdf', ash(async (request, res, next) => {
  const to = request.headers["to"]
  const name = request.headers["name"]


  const body = request.body
  try {

    await sendMail({ to, name }, await bufferToDataUrl("application/pdf", body))
    console.log(`Email sent to ${name} with ${to} address`);

    res.send(JSON.stringify({ status: "Success" }))

  } catch (error) {
    console.log(error);

    res.send(JSON.stringify({ status: "Failed" }))
  }
}))

app.post('/ticketpdf', ash(async (request, res, next) => {
  const to = request.headers["to"]
  const name = request.headers["name"]



  const body = request.body

  try {

    await sendMail({ to, name }, await bufferToDataUrl("application/pdf", body))

    console.log(`Email sent to ${name} with ${to} address`);
    res.send(JSON.stringify({ status: "Success" }))

  } catch (error) {
    console.log(error);

    res.send(JSON.stringify({ status: "Failed" }))
  }

}))


app.all('/', (request, res, next) => {
  res.send("Express")
})


app.listen(8080, () => {
  console.log("Server run at " + 8080);
})