const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const res = require("express/lib/response");
const jwt = require("jsonwebtoken");

const nodemailer = require("nodemailer");
const sgTransport = require("nodemailer-sendgrid-transport");

const port = process.env.PORT || 5000;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// DB Connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.k7pox.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// Jwt
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized Access" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({ message: "UnAuthorized Access" });
    }

    req.decoded = decoded;
    next();
  });

  // next();
}

// Email
const emailSenderOptions = {
  auth: {
    api_key: process.env.EMAIL_SENDER_KEY,
  },
};

const emailClient = nodemailer.createTransport(sgTransport(emailSenderOptions));

function sendAppointmentEmail(booking) {
  const { patient, patientName, treatment, date, slot } = booking;

  const email = {
    from: process.env.EMAIL_SENDER,
    to: patient,
    subject: `Your order for ${treatment} is on ${date} at ${slot} is confirmed`,
    text: `Your Appointment for ${treatment} is on ${date} at ${slot} is confirmed`,
    html: `
    <div>
      <h1>Hello ${patientName}</h1>
      <h3>Your Appointment for ${treatment} is confirmed</h3>
      <p>Lokking forward to seeing you on ${date} at ${slot}</p> 

      <h3>Our Address</h3>
      <p>Andor killa bandorban</p> 
      <p>Bangladesh</p>
      <a href="http://localhost:3000/">Unsubscribe</a>
    </div>
    `,
  };

  emailClient.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Message sent: ", info);
    }
  });
}

function sendPaymentConfirmationEmail(booking) {
  const { patient, patientName, treatment, date, slot } = booking;

  const email = {
    from: process.env.EMAIL_SENDER,
    to: patient,
    subject: `We have received your payment for ${treatment} is on ${date} at ${slot} is confirmed`,
    text: `Your payment for this Appointment ${treatment} is on ${date} at ${slot} is confirmed`,
    html: `
    <div>
      <h1>Hello ${patientName}</h1>
      <h3>Your Appointment for ${treatment} is confirmed</h3>
      <p>Lokking forward to seeing you on ${date} at ${slot}</p> 

      <h3>Our Address</h3>
      <p>Andor killa bandorban</p> 
      <p>Bangladesh</p>
      <a href="http://localhost:3000/">Unsubscribe</a>
    </div>
    `,
  };

  emailClient.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Message sent: ", info);
    }
  });
}
// API

async function run() {
  try {
    await client.connect();

    const productCollection = client.db("mastertools").collection("products");
    const userCollection = client.db("mastertools").collection("users");
    const orderCollection = client.db("mastertools").collection("orders");
    const reviewCollection = client.db("mastertools").collection("reviews");

    // const paymentCollection = client.db("mastertools").collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });

      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "UnAuthorized Access" });
      }
    };

    // Get API

    app.get("/product", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.get("/product/:id", async (req, res) => {
      const { id } = req.params;

      const query = { _id: ObjectId(id) };

      const result = await productCollection.findOne(query);

      // console.log(result);
      // const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.get("/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.get("/order/:email", async (req, res) => {
      const { email } = req.params;

      console.log(email);
      const query = { userEmail: email };

      const result = await orderCollection.find(query).toArray();

      res.send(result);
    });

    app.get("/users", verifyJWT, async (req, res) => {
      const cursor = await userCollection.find().toArray();
      res.send(cursor);
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;

      const user = await userCollection.findOne({ email });

      const isAdmin = user.role === "admin";

      res.send({ admin: isAdmin });
    });

    // Post API

    app.post("/product", async (req, res) => {
      const doc = req.body;
      const result = await productCollection.insertOne(doc);
      res.send(result);
    });

    app.post("/order", async (req, res) => {
      const doc = req.body;
      console.log(doc);
      const result = await orderCollection.insertOne(doc);
      res.send(result);
    });

    app.post("/review", async (req, res) => {
      const doc = req.body;
      // console.log(doc);
      const result = await reviewCollection.insertOne(doc);
      res.send(result);
    });

    // Payment API

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      // console.log(service);
      const price = service.price;
      const amount = price * 100;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Patch API

    // app.patch("/user/:email", async (req, res) => {
    //   const { email } = req.params;

    // });

    //  Put API

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const filter = { email };
      const updateDoc = {
        $set: { role: "admin" },
      };

      const result = await userCollection.updateOne(filter, updateDoc);

      res.send({ result });
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;

      const filter = { email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };

      const result = await userCollection.updateOne(filter, updateDoc, options);

      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2d",
      });

      res.send({ result, token });
    });

    //  Delete API
    app.delete("/order/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: ObjectId(id) };
      const deleteOrder = await orderCollection.deleteOne(query);
      console.log(deleteOrder);
      res.send(deleteOrder);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome to MasterTools");
});

app.listen(port, () => {
  console.log(`MasterTools App listening on port ${port}`);
});
