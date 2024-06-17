const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const stripe = require("stripe")(process.env.PAYMENT_SICRATE_KEY)
const app = express();
const port = process.env.PORT || 3000;

//middle wire 
app.use(cors())
app.use(express.json())
//jwt middle wire
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_USER_TOKEN, (error, decoded) => {
    if (error) {
      return res.status(403).send({ error: true, message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next();
  })
}



//==================================
//        MONGODB
//=================================


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri =process.env.DATABASE_URL

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const userCollection = client.db('summerCamp').collection('users');
const classCollection = client.db('summerCamp').collection('class');
const myClassedCollection = client.db('summerCamp').collection('mayClasses');
const paymentsCollection = client.db('summerCamp').collection('payments');

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })

      }
      next();
    }
// verify instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' })

      }
      next();
    }


    //jwt token collect;
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_USER_TOKEN, { expiresIn: '2h' });
      res.send({ token })
    })

    //user collection;
    app.get('/users',verifyJWT,verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result);
    })
    app.get('/users/role/:role', async (req, res) => {
      const role = req.params.role;
      const query = { role: role }
      const result = await userCollection.find(query).toArray()
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const newUser = req.body;

      const query = {email: newUser.email};
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({});
      }
       const result = await userCollection.insertOne(newUser);
      res.send(result);
    })

    // get user role
    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email;
      //todo jwt;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { userRole: user?.role }
      res.send(result);

    })

    //create admin api
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    //create instructor api

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    //class api;
    app.get('/class',verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    //for show in class page
    app.get('/class/approved', async (req, res) => {
      const query = {status: 'approved'}
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/class/popular', async (req, res)=>{
      const query = {status: 'approved'}
      const result = await classCollection.find(query).sort({enrolled: -1}).toArray();
      res.send(result)
    })

    // instructor's class
    app.get('/class/instructor/:email',verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/class/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    })


    app.post('/class',verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    // admin will update class status to approved
    app.put('/class/approve/:id',verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.findOneAndUpdate(query, { $set: { status: 'approved' } }, { returnOriginal: false })
      res.send(result);

    })
    app.put('/class/seats/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const classItem = await classCollection.findOne(query)
      const {seats, enrolled} = classItem
      const updateSeats = seats -1;
      const result = await classCollection.findOneAndUpdate(query, { $set: { seats:  updateSeats, enrolled: enrolled + 1} }, { returnOriginal: false })
      res.send(result);

    })
    app.put('/class/deny/:id',verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.findOneAndUpdate(query, { $set: { status: 'denied' } }, { returnOriginal: false })
      res.send(result);

    })

    app.patch('/class/feedback/:id',verifyJWT, verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      const feedback = req.body.feedback;
      console.log(feedback);
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set:{
          feedback
        }
      }

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    //my classes

    app.get('/myClasses/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await myClassedCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/myClasses/one/:id', async (req, res) => {
      const id = req.params.id;
      const query = { classId: id }
      const result = await myClassedCollection.findOne(query);
      res.send(result);
    })

    app.post('/myClasses',verifyJWT, async (req, res) => {
      const newClass = req.body;
      const result = await myClassedCollection.insertOne(newClass);
      res.send(result);
    });

    app.delete('/myClasses/:id',verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await myClassedCollection.deleteOne(query);
      res.send(result);
    });

    // enrolled class;
    app.get('/enroll/:email',verifyJWT, async (req, res)=>{
      const email = req.params.email;
      const query = {email: email};
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/payment-history/:email',verifyJWT, async (req, res)=>{
      const email = req.params.email;
      const query = {email: email};
      const result = await paymentsCollection.find(query).sort({date: -1}).toArray()
      res.send(result);
    })



    //payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //payment related api;
    app.post('/payment', async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);
      const query = {classId: payment.classId}
      const deletedResult = await myClassedCollection.deleteOne(query);
      res.send({ insertResult, deletedResult });
    })



    // Send a ping to confirm a successful connection
   // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


//***   BASIC SETUP    ***//

app.get('/', (req, res) => {
  res.send('camp is running')
})

app.listen(port, () => {
  console.log(`camp server is running on ${port}`);
})