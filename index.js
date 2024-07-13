
import express, { json } from 'express';
import { config } from 'dotenv'
import { ARRAY, DATEONLY, INTEGER, Op, STRING, Sequelize } from 'sequelize';
import { generate } from 'otp-generator';
import nodemailer from 'nodemailer';
config()
const app = express();
app.use(json());
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});
async function sendMail({ to, subject, text }) {
    try {
        await transporter.sendMail({ from: process.env.EMAIL, to, subject, text });
        return true;
    }
    catch (error) {
        console.error(error);
        return false;
    }
}


const getDaysArray = function (start, end) {
    const arr = [];
    for (const dt = new Date(start); dt <= new Date(end); dt.setDate(dt.getDate() + 1)) {
        arr.push(new Date(dt));
    }
    return arr;
};

const sq = new Sequelize(process.env.DB_URL);
const users = sq.define('users', { its: { primaryKey: true, type: INTEGER }, kitchen: { primaryKey: true, type: INTEGER }, otp: { type: INTEGER }, phone: { type: INTEGER }, email: { type: STRING } }, { freezeTableName: true, timestamps: false });
const skips = sq.define('skips', { date: { primaryKey: true, type: DATEONLY }, its_list: ARRAY(INTEGER) }, { freezeTableName: true, timestamps: false });
const menu = sq.define('menu', { date: { primaryKey: true, type: DATEONLY },  kitchen: { primaryKey: true, type: INTEGER }, items: ARRAY(STRING) }, { freezeTableName: true, timestamps: false });


app.post('/send_otp', async ({ body: { its } }, res) => {
    if (isNaN(its)) return res.json({ its, error: 'S0', message: 'Enter valid ITS' });
    its = parseInt(its);
    const otp = parseInt(generate(6, { digits: true, specialChars: false, lowerCaseAlphabets: false, upperCaseAlphabets: false }));
    const user = await users.findOne({ where: { its } });
    if (user == null) return res.json({ its, message: 'ITS not registered', error: 'S1' });
    const receipent = user.email//.phone;
    if (receipent == null) return res.json({ its, message: 'No valid email registered for the ITS number', error: 'S2' });
    // send SMS

    var sent = await sendMail({ to: receipent, subject: '[FMBConnect] Login OTP', text: `[FMBConnect] Your FMBConnect Login OTP is: ${otp}` });

    if (!sent) return res.json({ its, message: 'Could not send OTP try again later', error: 'S3' });
    await user.update({ otp });
    return res.json({ its, message: `OTP sent to ${receipent}` });
});

app.get('/verify_otp', async ({ body: { its, otp } }, res) => {
    const user = await users.findOne({ where: { its } });
    if (user == null) return res.json({ its, message: 'ITS not registered', auth: false, error: 'V1' });
    if (!user.otp) return res.json({ its, message: 'OTP not generated', auth: false, error: 'V2' });

    return res.json({ auth: otp == user.otp });
});
// app.post('/login', async ({ body }, res) => {
//     const { its, password } = body;
//     const user = await users.findOne({ where: { its, password } });
//     return res.json({ auth: user != null });
// })

app.post('/skip', async ({ body: { its, startDate, endDate } }, res) => {
    for (var date of getDaysArray(startDate, endDate)) {
        const [{ its_list }, isCreated] = (await skips.findOrCreate({ where: { date }, defaults: { its_list: [its] } }));
        if (isCreated) continue;
        !its_list.includes(its) && its_list.push(its);
        await skips.update({ its_list }, { where: { date } });
    }
    return res.json({ message: 'created' });
})


app.get('/skip', async ({ body: { its } }, res) => {
    const records = await skips.findAll({ where: { its_list: { [Op.contains]: [its] } } });
    const dates = records.map(({ date }) => date);
    return res.json({ dates });
})


app.get('/menu', async ({ body: {its, startDate, endDate, today } }, res) => {
    const user = await users.findOne({where:{its}});
    const kitchen =user?.kitchen;
    if (kitchen==null) return res.json({menu:[]});
    const menus = await menu.findAll({
        where: {
            [Op.and]:
                [
                    {kitchen},
                    { date: { [Op.gte]: startDate } },
                    { date: { [Op.lte]: endDate } }
                ]
        }
    });
    const menuToday = await menu.findOne({where:{kitchen, date:today }});
    return res.json({ menus, menuToday });
})
sq.sync({ alter: true }).then(() => { return; }).catch((err) => { console.error(err); });
app.listen(2000)
