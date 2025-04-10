const { db } = require("../connect");
const path = require("path");
const fs = require("fs");

// controllers/postProduct.js

// User posts a product for approval
async function handlePostProduct(req, res) {
  const { name, description, price, size, phoneNumber } = req.body;
  console.log("User", req.user);
  console.log("Post: ",req.body);
  // Getting userId from req.user (extracted by the middleware)
  const userId = req.user._id;
  console.log("UserID", userId);

  // Image handling
  const productImage = req.file ? req.file.filename : null;

  // Validate required fields
  if (!name || !description || !price || !size || !phoneNumber) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  // Validate phone number length (exactly 10 digits)
  if (phoneNumber.toString().length !== 10) {
    return res.status(400).json({ msg: "Phone number must be 10 digits" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO ClientProduct (UserID, Name, Description, Price, Image, Size, PhoneNumber, Status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, name, description, price, productImage, size, phoneNumber]
    );

    const imageUrl = productImage ? `${req.protocol}://${req.get("host")}/uploads/${productImage}` : null;

    return res.status(201).json({
      status: "success",
      id: result.insertId,
      msg: "Product submitted for approval",
      image: imageUrl,
    });
  } catch (error) {
    console.error("Error inserting into database:", error);
    return res.status(500).json({
      status: "error",
      msg: "Internal server error",
      error: error.message,
    });
  }
}

// User gets their posted products with status
async function handleGetUserPostedProducts(req, res) {
  const userId = req.user._id; // From auth middleware (user ID is now extracted as _id)

  try {
    const [rows] = await db.query(
      "SELECT * FROM ClientProduct WHERE UserID = ? ORDER BY CreatedAt DESC",
      [userId]
    );

    // Update image field to full URL
    const updatedRows = rows.map((product) => ({
      ...product,
      Image: product.Image ? `${req.protocol}://${req.get("host")}/uploads/${product.Image}` : null,
    }));

    return res.status(200).json(updatedRows);
  } catch (error) {
    console.error("Error fetching user products:", error);
    return res.status(500).json({
      status: "error",
      msg: "Internal server error",
      error: error.message,
    });
  }
}

// Admin gets all pending products
async function handleGetPendingProducts(req, res) {
  // This should be protected by admin middleware
  try {
    const [rows] = await db.query(
      "SELECT p.*, u.name as UserName, u.email as UserEmail FROM ClientProduct p JOIN Users u ON p.UserID = u.id WHERE p.Status = 'pending' ORDER BY p.CreatedAt ASC"
    );

    // Update image field to full URL
    const updatedRows = rows.map((product) => ({
      ...product,
      Image: product.Image ? `${req.protocol}://${req.get("host")}/uploads/${product.Image}` : null,
    }));

    return res.status(200).json(updatedRows);
  } catch (error) {
    console.error("Error fetching pending products:", error);
    return res.status(500).json({
      status: "error",
      msg: "Internal server error",
      error: error.message,
    });
  }
}

// Admin approves or rejects a product
async function handleUpdateProductStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  // Validate status
  if (!status || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({ msg: "Valid status (approved or rejected) is required" });
  }

  try {
    // First check if product exists
    const [product] = await db.query("SELECT * FROM ClientProduct WHERE id = ?", [id]);

    if (product.length === 0) {
      return res.status(404).json({ msg: "Product not found" });
    }

    // If approved, also add to the main Products table
    if (status === "approved") {
      const productData = product[0];

      await db.query(
        `INSERT INTO Products (Name, Description, Price, Image) 
         VALUES (?, ?, ?, ?)`,
        [productData.Name, productData.Description, productData.Price, productData.Image]
      );
    }

    // Update the status in ClientProduct
    await db.query(
      `UPDATE ClientProduct SET Status = ? WHERE id = ?`,
      [status, id]
    );

    return res.status(200).json({
      status: "success",
      msg: `Product ${status === 'approved' ? 'approved and added to store' : 'rejected'}`,
    });
  } catch (error) {
    console.error("Error updating product status:", error);
    return res.status(500).json({
      status: "error",
      msg: "Internal server error",
    });
  }
}

// Get product by ID
async function handleGetProductById(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ msg: "Invalid product ID" });
  }

  try {
    const [rows] = await db.query("SELECT * FROM ClientProduct WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ msg: "Product not found" });
    }

    const product = rows[0];
    product.Image = product.Image ? `${req.protocol}://${req.get("host")}/uploads/${product.Image}` : null;

    return res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return res.status(500).json({
      status: "error",
      msg: "Internal server error",
    });
  }
}

// User deletes their posted product (only if pending)
async function handleDeletePostedProduct(req, res) {
  const id = Number(req.params.id);
  const userId = req.user._id; // UserID now extracted as _id from auth middleware

  try {
    // Check if product exists and belongs to user
    const [product] = await db.query(
      "SELECT * FROM ClientProduct WHERE id = ? AND UserID = ?", 
      [id, userId]
    );

    if (product.length === 0) {
      return res.status(404).json({ msg: "Product not found or not authorized" });
    }

    // Only allow deletion if status is pending
    if (product[0].Status !== 'pending') {
      return res.status(400).json({ 
        msg: "Cannot delete a product that has already been reviewed by admin" 
      });
    }

    // Delete the image if it exists
    if (product[0].Image) {
      const imagePath = path.join(__dirname, "../uploads", product[0].Image);
      fs.unlink(imagePath, (err) => {
        if (err) console.log("Error deleting image:", err);
      });
    }

    const [result] = await db.query(
      "DELETE FROM ClientProduct WHERE id = ? AND UserID = ?", 
      [id, userId]
    );

    return res.status(200).json({
      status: "success",
      msg: "Product submission deleted successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({
      status: "error",
      msg: "Internal server error",
    });
  }
} ; 

// Function to get all approved products
async function handleGetApprovedProducts(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT * FROM ClientProduct WHERE Status = 'approved' ORDER BY CreatedAt DESC"
    );

    // Update image field to full URL
    const updatedRows = rows.map((product) => ({
      ...product,
      Image: product.Image ? `${req.protocol}://${req.get("host")}/uploads/${product.Image}` : null,
    }));

    return res.status(200).json(updatedRows);
  } catch (error) {
    console.error("Error fetching approved products:", error);
    return res.status(500).json({
      status: "error",
      msg: "Internal server error",
      error: error.message,
    });
  }
}

module.exports = { 
  handlePostProduct,
  handleGetUserPostedProducts,
  handleGetPendingProducts,
  handleUpdateProductStatus,
  handleGetProductById,
  handleDeletePostedProduct,
  handleGetApprovedProducts
};