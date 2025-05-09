const express = require('express')
const mongoose = require('mongoose');
const Product = require('./model/product');
const User = require('./model/user');
const Admin = require('./model/admin');
const Order = require('./model/order');
const cors = require('cors')
const app = express();
const multer = require('multer')
const { cloudinary, storage, checkCloudinaryConnection } = require('./cloudinary/main.js')

app.use(cors({ origin: '*' }))


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 
const dbUrl = process.env.DB_URL ||  'mongodb://127.0.0.1:27017/marble_db';

mongoose.connect(dbUrl);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'CONNECTION FAILED!'));
db.once('open', () => {
    console.log('DATABASE CONNECTED');
});

const upload = multer({ storage });

checkCloudinaryConnection().then((isConnected) => {
    if (isConnected) {
        console.log('Cloudinary is connected and ready for use.');
    } else {
        console.error('Cloudinary connection failed. Please check your configuration.');
    }
});


app.get('/products', async (req, res) => {
    try {
        console.log('getting products')
        const products = await Product.find({});
        if (!products) {
            return res.status(400).json({ message: 'Products Not Found' })
        }

        res.json({ products: products })
    } catch (e) {
        console.error(e)
        res.status(400).json({ message: 'Internal Server Error' })
    }
})

app.get('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.find({ id: id })
        if (!product) {
            return res.status(400).json({ message: 'Product Not Found' })
        }
        res.json({ product: product })
    } catch (e) {
        console.error(e)
        res.status(400).json({ message: 'Internal Server Error' })
    }
})

app.get('/user/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const user = await User.findOne({ uid: uid })

        if (!user) {
            return res.status(400).json({ message: 'User Not Found' })
        }
        res.json({ user: user })
    } catch (e) {
        console.error(e)
        res.status(400).json({ message: 'Internal Server Error' })
    }
})

app.get('/admin/:uid', async (req, res) => {
    try {

        const { uid } = req.params;
        console.log(uid)
        const admin = await Admin.findOne({ uid: uid })

        if (!admin) {
            return res.status(400).json({ message: 'Admin Not Found for this UID' })
        }

        res.json({admin: admin})
    } catch (e) {
        console.error(e)
        res.status(400).json({ message: 'Internal Server Error' })
    }
})

app.post('/admin/register', async (req, res) => {
    try {
        const { name, phone, email, uid } = req.body;

        const admin = new Admin({ name: name, uid: uid, phone: phone, email: email })

        res.json({ message: 'Admin Added Successfully', admin: admin })
    } catch (e) {
        console.error(e)
        res.status(400).json({ message: 'Internal Server Error' })
    }
})

app.post('/user/register', async (req, res) => {
    try {
        const { name, uid, phone_number, email, address } = req.body;
        const user = new User({ name: name, uid: uid, phone_number: phone_number, email: email, address: address })
await user.save();
console.log(user)
        res.json({ message: 'User Added Successfully', success: true, user: user })
    } catch (e) {
        console.error(e)
        res.status(400).json({ message: 'Internal Server Error', success: false })
    }
});


app.post('/orders', async (req, res) => {
    try {
        const { userId, products } = req.body;

        console.log('Order Received');

        if (!userId || !products.length) {
            return res.status(400).json({ error: 'User ID and products are required' });
        }

        const user = await User.findOne({ uid: userId });
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        const productIds = products.map(item => item.product);
        const foundProducts = await Product.find({ _id: { $in: productIds } });

        if (foundProducts.length !== products.length) {
            return res.status(404).json({ error: 'One or more products not found' });
        }

        let totalAmount = 0;

        for (const item of products) {
            const product = foundProducts.find(p => p._id.toString() === item.product.toString());

            if (product) {
                if (product.stock < item.quantity) {
                    return res.status(400).json({ error: `Not enough stock for ${product.name}` });
                }

                totalAmount += product.price * item.quantity;

                // Reduce stock
                product.stock -= item.quantity;
                await product.save();
            }
        }

        const newOrder = new Order({
            user: user._id,
            products,
            total_amount: totalAmount
        });

        await newOrder.save();
        res.status(201).json({ message: 'Order placed successfully', order: newOrder });

    } catch (err) {
        console.error('Error placing order:', err);
        res.status(500).json({ error: 'Error placing order', message: err.message });
    }
});



app.get('/orders', async(req, res) => {
    try{
       console.log('fetching orders')
       const orders = await Order.find({}).populate('products.product').populate('user');
       res.json({orders: orders, message: 'successsfully fetched the orders'})
    }catch(e){
        console.error('Error placing order:', e);
        res.status(500).json({ error: 'Error fetching orders', message: e.message });
    }
})



app.post('/add-product', upload.single('image'), async (req, res) => {
    try {
        const { name, price, wheretouse, category, description, stock } = req.body;

        console.log({ name, price, wheretouse, category, description, stock })

        const image =  { url: req.file.path, filename: req.file.filename }
            

        const product = new Product({
            name,
            price,
            wheretouse,
            category,
            description,
            image,
            stock
        });

        await product.save();
        res.status(201).json({ message: 'Product added successfully', product });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error adding product' });
    }
});

app.get('/orders/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const admin = await Admin.findOne({ uid: uid })
        const orders = await Order.find({})

        if (!admin) {
            return res.status(400).json({ message: 'Admin uid is required for authentication purpose.' })
        }

        res.status(201).json({ orders: orders })
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

app.delete("/delete-product/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deletedProduct = await Product.findByIdAndDelete(id);
  
      if (!deletedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
  
      res.json({ message: "Product deleted successfully", deletedProduct });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });


app.get('/hello-world', async (req, res) => {
    res.send('Hello world!')
});



app.listen(process.env.PORT || 3000, () => {
    console.log('Listening to the port 3000')
})