import { config } from 'dotenv'
const dotenv = config()

console.log(process.env);

import express from 'express'
import cors from "cors"
import nodemailer from "nodemailer"
import ash from 'express-async-handler'
import bodyParser from 'body-parser'
const app = express()
import { default as bufferToDataUrl } from "buffer-to-data-url"
import { PrismaClient, type Ticket as T, type Merch as M, MerchSize } from '@prisma/client'
import { randomBytes } from 'crypto'


const prisma = new PrismaClient({})


export function qr() {
    const qr = randomBytes(12).toString('hex')
    return `${Date.now()}${qr}`;
}

export type Ticket = T & { valid: boolean }
export type Merch = M & { valid: boolean }


export type CheckReturn<T> = Promise<T | null>
export type APIResponse<T> = T | { error: string }



export const model = prisma.$extends({
    result: {
        ticket: {
            valid: {
                needs: { checkInAt: true },
                compute(data) {
                    return data.checkInAt === null
                }
            },
        },

        merch: {
            valid: {
                needs: { claimedAt: true },
                compute(data) {
                    return data.claimedAt === null
                },
            }
        }
    },

})





export async function sendMail({ to, name, base64string, as = "e-Ticket" }: { to: string, base64string: string, as?: "e-Ticket" | "e-Ticket dan Merch Receipt", name: string }) {
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
                path: base64string,
                filename: `${as}.pdf`
            }
        ]


    })
}


app.use(cors({
    methods: ["POST"],
    preflightContinue: true
}))


app.use(bodyParser.raw({ limit: '2000kb', type: 'application/pdf' }));
app.use(express.json({ limit: '2000kb' }));


const email = process.env.EMAIL_USER
const pw = process.env.EMAIL_PASSWORD


const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: email,
        pass: pw
    },
})

function resData<T>(data: T) {
    return { data, error: null }
}

function resError(err: unknown) {
    return { data: null, error: (err as Error).message }
}


app.post('/bundlingpdf', ash(async (request, res, next) => {
    const to = request.headers["to"] as string
    const name = request.headers["name"] as string


    const body = request.body
    try {

        await sendMail({ to, name, as: "e-Ticket dan Merch Receipt", base64string: await bufferToDataUrl("application/pdf", body) })
        console.log(`Email sent to ${name} with ${to} address`);

        res.send(JSON.stringify({ status: "Success" }))

    } catch (error) {
        console.log(error);

        res.send(JSON.stringify({ status: "Failed" }))
    }
}))

app.post('/ticketpdf', ash(async (request, res, next) => {
    const to = request.headers["to"] as string
    const name = request.headers["name"] as string



    const body = request.body

    try {

        await sendMail({ to, name, base64string: await bufferToDataUrl("application/pdf", body) })

        console.log(`Email sent to ${name} with ${to} address`);
        res.send(JSON.stringify({ status: "Success" }))

    } catch (error) {
        console.log(error);

        res.send(JSON.stringify({ status: "Failed" }))
    }

}))

app.get('/stats', ash(async (req, res, next) => {
    try {
        const tickets = await model.ticket.findMany({ include: { Merch: true }, orderBy: { createdAt: "desc" } })
        res.send(resData(tickets));
        await model.$disconnect()
    } catch (e) {
        console.log((e as Error).message)
        res.send(resError(e));
    }
}))

app.post('/order-ticket', ash(async (req, res, next) => {
    try {
        const data: { name: string, email: string } = req.body
        const ticket = await model.ticket.create({
            data: { name: data.name, qr: qr(), email: data.email },
        })
        res.send(resData(ticket));
        await model.$disconnect()
    } catch (error) {
        console.log(error)
        res.send(resError(error));
    }
}))

app.post('/order-bundling', ash(async (req, res, next) => {
    try {
        const data: { name: string, size: MerchSize, email: string } = req.body
        const ticket = await model.ticket.create({
            include: {
                Merch: true
            },
            data: {
                name: data.name,
                qr: qr(),
                email: data.email,
                Merch: {
                    create: {
                        qr: qr(),
                        name: data.name,
                        size: data.size
                    }
                }
            }
        })
        res.send(resData(ticket));
        await model.$disconnect()
    } catch (error) {
        console.log(error)
        res.send(resError(error));
    }
}))

app.get('/merch-get', ash(async (req, res, next) => {
    try {
        const qr = req.headers["qr"] as string
        const merch = await model.merch.findUnique({ where: { qr } })
        res.send(resData(merch));
        await model.$disconnect()
    } catch (error) {
        console.log(error)
        res.send(resError(error));
    }
}))

app.get('/ticket-get', ash(async (req, res, next) => {
    try {
        const qr = req.headers["qr"] as string
        const ticket = await model.ticket.findUnique({ where: { qr } })
        res.send(resData(ticket));
        await model.$disconnect()
    } catch (error) {
        console.log(error)
        res.send(resError(error));
    }
}))


app.get('/merch-up', ash(async (req, res, next) => {
    try {
        const qr = req.headers["qr"] as string
        const merch = await model.merch.update({ where: { qr }, data: { claimedAt: new Date() } })
        res.send(resData(merch));
        await model.$disconnect()
    } catch (error) {
        console.log(error)
        res.send(resError(error));
    }
}))

app.get('/ticket-up', ash(async (req, res, next) => {
    try {
        const qr = req.headers["qr"] as string
        const ticket = await model.ticket.update({ where: { qr }, data: { checkInAt: new Date() } })
        res.send(resData(ticket));
        await model.$disconnect()
    } catch (error) {
        console.log(error)
        res.send(resError(error));
    }
}))

app.post('/replace-with-pdf', ash(async (req, res) => {

}))




app.all('/', (request, res, next) => {
    res.send("Express")
})


app.listen(3000, () => {
    console.log("Server run at " + 8080);
})