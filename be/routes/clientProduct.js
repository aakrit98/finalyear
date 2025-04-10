const express = require("express");
const router = express.Router();
const upload = require("../middleware/multer"); // Middleware to handle image uploads
const { restrictToLoggedinUserOnly, restrictToAdminOnly } = require("../middleware/auth"); // Auth middleware

const {
  handlePostProduct,
  handleGetUserPostedProducts,
  handleGetPendingProducts,
  handleUpdateProductStatus,
  handleGetProductById,
  handleDeletePostedProduct,
  handleGetApprovedProducts
} = require("../controllers/clientProduct");

// ✅ Post a new product (with image upload)
router.post("/post", restrictToLoggedinUserOnly, upload.single("image"), handlePostProduct);

// ✅ Get products posted by the logged-in user (or fallback to userId from query)
router.get("/user", restrictToLoggedinUserOnly, handleGetUserPostedProducts);

// ✅ Get all pending products (admin)
router.get("/pending", handleGetPendingProducts);

// ✅ Approve or reject a product (admin)
router.patch("/status/:id", handleUpdateProductStatus);

// ✅ Get all approved products (for client frontend)
router.get("/approved", handleGetApprovedProducts);

// ✅ Delete a pending product posted by the user
router.delete("/:id", restrictToLoggedinUserOnly, handleDeletePostedProduct);

// ✅ Get a specific product by ID - Must be after other specific routes to avoid conflicts
router.get("/:id", handleGetProductById);

module.exports = router;