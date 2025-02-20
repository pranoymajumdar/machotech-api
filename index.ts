import Express, { type Request, type Response } from "express";
import { categoriesRouter } from "./routes/category.route";
import multer from "multer";
import path from "path";
import cors from 'cors';
import { productsRouter } from "./routes/products.route";
// Fix the storage path
const uploadDir = path.join(__dirname, 'uploads/categories');
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

const app = Express();
app.use(cors())
app.use(Express.json());

// For serving static files
app.use('/uploads', Express.static(path.join(__dirname, 'uploads')));

app.use('/categories', categoriesRouter);
app.use('/products', productsRouter);

app.post('/upload/categories', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file received" });
    return;
  }
  
  // Create the file URL
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/categories/${req.file.filename}`;
  
  // Send the URL to frontend
  res.status(200).json({ 
    success: true, 
    fileUrl: fileUrl
  });
});
app.listen(3000, () => console.log('Server started!'));