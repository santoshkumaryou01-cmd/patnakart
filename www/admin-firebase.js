alert("PatnaKart Firebase module loaded");
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where, serverTimestamp, writeBatch, onSnapshot
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHmlidYtBZuly5v1GCtJgyRQ7vuxoFF50",
  authDomain: "patnakart-6925b.firebaseapp.com",
  projectId: "patnakart-6925b",
  storageBucket: "patnakart-6925b.firebasestorage.app",
  messagingSenderId: "196022347291",
  appId: "1:196022347291:web:7302cf0f9fb4c932f17abe"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {}, "default");

window.adminLoginUser = async function() {
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const msg = document.getElementById("adminMessage");

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const adminDoc = await getDoc(doc(db, "admins", result.user.uid));

    if (!adminDoc.exists() || adminDoc.data().role !== "admin") {
      await signOut(auth);
      msg.innerText = "आप Admin नहीं हैं।";
      return;
    }

    document.getElementById("adminLogin").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
    window.loadAdminProducts();
    window.loadSellerApplications();

    await window.createSellerOrders();
    await window.loadAdminOrders();

  } catch (error) {
    msg.innerText = (error.code || "unknown") + ": " + error.message;
  }
};

window.adminLogout = async function() {
  await signOut(auth);
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("adminLogin").style.display = "block";
};

window.addNewProduct = async function() {
  const name = document.getElementById("newProductName").value.trim();
  const price = Number(document.getElementById("newProductPrice").value);
  const emoji = document.getElementById("newProductEmoji").value.trim();

  if (!name || !Number.isFinite(price) || price <= 0) {
    alert("सही Product Name और Price डालें।");
    return;
  }

  try {
    await addDoc(collection(db, "products"), {
      name,
      price,
      emoji: emoji || "🛍️",
      status: "approved"
    });

    alert("Product Added!");
    window.loadAdminProducts();

  } catch (error) {
    alert(error.message);
  }
};

window.loadAdminProducts = async function() {
  const box = document.getElementById("adminProducts");

  try {
    const snapshot = await getDocs(collection(db, "products"));
    box.innerHTML = "<h3>Products</h3>";

    snapshot.forEach(productDoc => {
      const p = productDoc.data();
      const item = document.createElement("div");
      item.className = "cartitem";

      const name = document.createElement("strong");
      name.textContent = p.name || "Unnamed Product";

      const price = document.createElement("p");
      price.textContent = "Price: ₹" + (p.price || 0);

      if (p.status === "pending") {
        const approveBtn = document.createElement("button");
        approveBtn.textContent = "Approve Product";
        approveBtn.onclick = () => window.approveSellerProduct(productDoc.id);
        item.appendChild(approveBtn);
      }

      const btn = document.createElement("button");
      btn.textContent = "Delete";
      btn.onclick = () => window.deleteAdminProduct(productDoc.id);

      item.append(name, price, btn);
      box.appendChild(item);
    });

  } catch (error) {
    box.textContent = error.message;
  }
};

window.deleteAdminProduct = async function(id) {
  if (!confirm("क्या आप यह Product Delete करना चाहते हैं?")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    window.loadAdminProducts();
  } catch (error) {
    alert(error.message);
  }
};


window.loadStoreProducts = async function() {
  try {
    const snapshot = await getDocs(query(collection(db, "products"), where("status", "==", "approved")));
    const list = [];
    snapshot.forEach((item) => {
      const product = item.data();
      if (product.status === "approved") {
        list.push({
          id: item.id,
          name: product.name,
          price: Number(product.price) || 0,
          emoji: product.emoji || "🛍️",
          image: product.image || "",
          sellerId: product.sellerId || "admin",
          inStock: product.inStock !== false
        });
      }
    });
    alert("Firebase से मिले Approved Products: " + snapshot.size); window.setStoreProducts(list);
  } catch (error) {
    console.error("Customer products load error:", error); alert("Firebase Error: " + error.code + " - " + error.message);
  }
};

window.loadStoreProducts();


// SELLER REGISTRATION
window.sellerRegister = async function() {
  const ownerName = document.getElementById("sellerOwnerName").value.trim();
  const shopName = document.getElementById("sellerShopName").value.trim();
  const email = document.getElementById("sellerEmail").value.trim();
  const password = document.getElementById("sellerPassword").value;
  const msg = document.getElementById("sellerRegisterMessage");

  if (!ownerName || !shopName || !email || !password) {
    msg.textContent = "सभी जानकारी भरें।";
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const uid = result.user.uid;

    await setDoc(doc(db, "sellerApplications", uid), {
      uid,
      ownerName,
      shopName,
      email,
      status: "pending"
    });

    await signOut(auth);
    msg.textContent = "Registration सफल! Admin की मंजूरी का इंतजार करें।";
  } catch (error) {
    msg.textContent = "त्रुटि: " + error.message;
  }
};

// DELIVERY BOY REGISTRATION
window.deliveryBoyRegister = async function() {
  const name = document.getElementById("deliveryBoyName").value.trim();
  const phone = document.getElementById("deliveryBoyPhone").value.trim();
  const email = document.getElementById("deliveryBoyEmail").value.trim();
  const password = document.getElementById("deliveryBoyPassword").value;
  const msg = document.getElementById("deliveryRegisterMessage");

  if (!name || !phone || !email || !password) {
    msg.textContent = "सभी जानकारी भरें।";
    return;
  }

  if (!/^[6-9][0-9]{9}$/.test(phone)) {
    msg.textContent = "सही 10 अंकों का मोबाइल नंबर भरें।";
    return;
  }

  if (password.length < 6) {
    msg.textContent = "Password कम से कम 6 अक्षर का होना चाहिए।";
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const uid = result.user.uid;

    await setDoc(doc(db, "deliveryApplications", uid), {
      uid,
      name,
      phone,
      email,
      status: "pending",
      createdAt: serverTimestamp()
    });

    await signOut(auth);
    msg.textContent = "Registration सफल! Admin Approval का इंतजार करें।";
  } catch (error) {
    try {
      if (auth.currentUser) await signOut(auth);
    } catch (_) {}
    msg.textContent = "त्रुटि: " + error.message;
  }
};


// DELIVERY BOY ASSIGNED ORDERS
window.loadDeliveryBoyOrders = async function() {
  const box = document.getElementById("deliveryBoyOrders");
  const message = document.getElementById("deliveryBoyMessage");
  const user = auth.currentUser;

  if (!user) {
    message.textContent = "पहले Delivery Boy Login करें।";
    return;
  }

  box.textContent = "Assigned Orders लोड हो रहे हैं...";

  try {
    const application = await getDoc(doc(db, "deliveryApplications", user.uid));

    if (!application.exists() || application.data().status !== "approved") {
      box.textContent = "आपका अकाउंट Approved नहीं है।";
      return;
    }

    const ordersQuery = query(
      collection(db, "orders"),
      where("deliveryBoyUid", "==", user.uid)
    );

    const snapshot = await getDocs(ordersQuery);
    box.replaceChildren();

    if (snapshot.empty) {
      box.textContent = "अभी आपके नाम पर कोई Order Assign नहीं हुआ है।";
      message.textContent = "Assigned Orders यहाँ दिखाई देंगे।";
      return;
    }

    snapshot.forEach(orderDoc => {
      const data = orderDoc.data();
      const card = document.createElement("div");
      card.className = "cartbox";

      const heading = document.createElement("h3");
      heading.textContent = "Order ID: " + orderDoc.id;
      card.appendChild(heading);

      const fields = [
        ["Customer", data.customerName || "—"],
        ["Phone", data.customerPhone || "—"],
        ["Address", data.customerAddress || "—"],
        ["Total", "₹" + (data.total ?? "—")],
        ["Payment", data.payment || "—"],
        ["Status", data.status || "—"]
      ];

      fields.forEach(([label, value]) => {
        const p = document.createElement("p");
        p.textContent = label + ": " + value;
        card.appendChild(p);
      });

      const itemsHeading = document.createElement("p");
      itemsHeading.textContent = "Order Items:";
      card.appendChild(itemsHeading);

      const items = Array.isArray(data.orderLines) ? data.orderLines : (Array.isArray(data.items) ? data.items : []);
      if (items.length) {
        items.forEach(item => {
          const p = document.createElement("p");
          p.textContent =
            (item.name || item.title || item.productName || "Product") +
            " × " + (item.quantity || 1);
          card.appendChild(p);
        });
      } else {
        const p = document.createElement("p");
        p.textContent = "Item details उपलब्ध नहीं हैं।";
        card.appendChild(p);
      }

      if (data.status === "packed" || data.status === "out_for_delivery") {
        const button = document.createElement("button");
        button.textContent = data.status === "packed"
          ? "डिलीवरी के लिए निकला"
          : "Delivered";

        button.onclick = async () => {
          button.disabled = true;
          try {
            const nextStatus = data.status === "packed"
              ? "out_for_delivery"
              : "delivered";

            await updateDoc(doc(db, "orders", orderDoc.id), {
              status: nextStatus,
              deliveryUpdatedAt: serverTimestamp()
            });

            message.textContent = "Order Status अपडेट हो गया।";
            await window.loadDeliveryBoyOrders();
          } catch (error) {
            button.disabled = false;
            message.textContent = "Status Update Error: " + error.message;
          }
        };

        card.appendChild(button);
      } else {
        const p = document.createElement("p");
        p.textContent = data.status === "delivered"
          ? "यह Order Delivered हो चुका है।"
          : "इस Order पर अभी कोई Delivery Action उपलब्ध नहीं है।";
        card.appendChild(p);
      }

      box.appendChild(card);
    });

    message.textContent = "आपके Assigned Orders: " + snapshot.size;
  } catch (error) {
    box.textContent = "Orders लोड नहीं हुए: " + error.message;
  }
};

// DELIVERY BOY LOGIN
window.deliveryBoyLogin = async function() {
  const email = document.getElementById("deliveryLoginEmail").value.trim();
  const password = document.getElementById("deliveryLoginPassword").value;
  const msg = document.getElementById("deliveryLoginMessage");

  if (!email || !password) {
    msg.textContent = "Email और Password भरें।";
    return;
  }

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const uid = result.user.uid;
    const application = await getDoc(doc(db, "deliveryApplications", uid));

    if (!application.exists() || application.data().status !== "approved") {
      await signOut(auth);
      msg.textContent = "आपका Delivery Boy अकाउंट अभी Admin से Approved नहीं है।";
      return;
    }

    document.getElementById("deliveryRegistration").style.display = "none";
    document.getElementById("deliveryBoyPanel").style.display = "block";
    document.getElementById("deliveryBoyWelcome").textContent =
      "स्वागत है, " + application.data().name;
    document.getElementById("deliveryBoyMessage").textContent =
      "Login सफल! आपके Assigned Orders नीचे हैं।";
    msg.textContent = "Login सफल!";
    await window.loadDeliveryBoyOrders();
  } catch (error) {
    msg.textContent = "त्रुटि: " + error.message;
  }
};

// DELIVERY BOY LOGOUT
window.deliveryBoyLogout = async function() {
  try {
    await signOut(auth);
    document.getElementById("deliveryBoyPanel").style.display = "none";
    document.getElementById("deliveryRegistration").style.display = "block";
    document.getElementById("deliveryLoginMessage").textContent = "Logout हो गया।";
  } catch (error) {
    document.getElementById("deliveryBoyMessage").textContent =
      "Logout त्रुटि: " + error.message;
  }
};

// SELLER LOGIN
window.sellerLogin = async function() {
  const email = document.getElementById("sellerLoginEmail").value.trim();
  const password = document.getElementById("sellerLoginPassword").value;
  const msg = document.getElementById("sellerLoginMessage");

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const uid = result.user.uid;
    const application = await getDoc(doc(db, "sellerApplications", uid));

    if (!application.exists() || application.data().status !== "approved") {
      await signOut(auth);
      msg.textContent = "आपका Seller अकाउंट अभी Admin से Approved नहीं है।";
      return;
    }

    document.getElementById("sellerRegistration").style.display = "none";
    document.getElementById("sellerPanel").style.display = "block";
    document.getElementById("sellerWelcome").textContent =
      "स्वागत है, " + application.data().shopName;
    msg.textContent = "Login सफल!";
    await window.loadSellerDashboard();
    await window.loadSellerOrders();
  } catch (error) {
    msg.textContent = "त्रुटि: " + error.message;
  }
};

window.sellerResetPassword = async function() {
  const email = document.getElementById("sellerLoginEmail").value.trim();
  const msg = document.getElementById("sellerLoginMessage");

  if (!email) {
    msg.textContent = "पहले अपना Seller Email भरें।";
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    msg.textContent = "Password Reset Link आपके Email पर भेज दिया गया है।";
  } catch (error) {
    msg.textContent = "त्रुटि: " + error.message;
  }
};

// SELLER PRODUCT SUBMISSION
let editingSellerProductId = null;
let editingSellerProductImage = "";

window.sellerAddProduct = async function() {
  const user = auth.currentUser;
  const name = document.getElementById("sellerProductName").value.trim();
  const price = Number(document.getElementById("sellerProductPrice").value);
  const emoji = document.getElementById("sellerProductEmoji").value.trim();
  const category = document.getElementById("sellerProductCategory").value;
  const description = document.getElementById("sellerProductDescription").value.trim();
  const msg = document.getElementById("sellerProductMessage");

  if (!user) {
    msg.textContent = "पहले Seller Login करें।";
    return;
  }

  if (!name || !Number.isFinite(price) || price <= 0) {
    msg.textContent = "Product का नाम और सही कीमत भरें।";
    return;
  }

  try {
    msg.textContent = "Product तैयार हो रहा है...";
    const uploadedImage = await window.uploadSellerProductImage();
    const image = uploadedImage || editingSellerProductImage;

    const productData = {
      name,
      price,
      emoji: emoji || "🛍️",
      category,
      description,
      image,
      sellerId: user.uid,
      status: "pending"
    };

    if (editingSellerProductId) {
      await updateDoc(doc(db, "products", editingSellerProductId), productData);
      msg.textContent = "Product अपडेट हो गया। दोबारा Admin की मंजूरी के लिए भेज दिया गया है।";
    } else {
      await addDoc(collection(db, "products"), productData);
      msg.textContent = "Product और फोटो Admin की मंजूरी के लिए भेज दिए गए हैं।";
    }

    editingSellerProductId = null;
    editingSellerProductImage = "";
    document.getElementById("sellerSubmitButton").textContent = "Submit Product for Approval";
    document.getElementById("sellerCancelEdit").style.display = "none";

    await window.loadSellerDashboard();

    document.getElementById("sellerProductName").value = "";
    document.getElementById("sellerProductPrice").value = "";
    document.getElementById("sellerProductEmoji").value = "";
    document.getElementById("sellerProductCategory").value = "";
    document.getElementById("sellerProductDescription").value = "";
    document.getElementById("sellerProductImage").value = "";
    document.getElementById("sellerProductImagePreview").style.display = "none";
    document.getElementById("sellerImageUploadMessage").textContent = "";

  } catch (error) {
    console.error("Seller Product Error:", error);
    msg.textContent = "त्रुटि: " + error.message;
  }
};

// SELLER DASHBOARD
window.loadSellerDashboard = async function() {
  const user = auth.currentUser;
  const message = document.getElementById("sellerDashboardMessage");
  const list = document.getElementById("sellerProductList");

  if (!user) return;

  message.textContent = "आपके प्रोडक्ट लोड हो रहे हैं...";
  list.replaceChildren();

  try {
    const q = query(
      collection(db, "products"),
      where("sellerId", "==", user.uid)
    );

    const snapshot = await getDocs(q);
    let pending = 0;
    let approved = 0;

    snapshot.forEach(docSnap => {
      const product = docSnap.data();

      if (product.status === "pending") pending++;
      if (product.status === "approved") approved++;

      const card = document.createElement("li");
      card.style.cssText =
        "list-style:none;border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0;";

      if (product.image) {
        const img = document.createElement("img");
        img.src = product.image;
        img.alt = product.name || "Product";
        img.style.cssText =
          "width:110px;height:110px;object-fit:cover;border-radius:8px;";
        card.appendChild(img);
      }

      const title = document.createElement("h4");
      title.textContent = product.name || "बिना नाम";
      card.appendChild(title);

      const price = document.createElement("p");
      price.textContent = "कीमत: ₹" + (product.price || 0);
      card.appendChild(price);

      const status = document.createElement("p");
      status.textContent =
        "स्थिति: " +
        (product.status === "approved" ? "Approved ✅" :
         product.status === "pending" ? "Pending ⏳" : product.status);
      card.appendChild(status);

      const category = document.createElement("p");
      category.textContent = "Category: " + (product.category || "अन्य");
      card.appendChild(category);

      if (product.status === "approved") {
        const isInStock = product.inStock !== false;

        const stockStatus = document.createElement("p");
        stockStatus.textContent = isInStock
          ? "Stock: In Stock ✅"
          : "Stock: Out of Stock ❌";
        card.appendChild(stockStatus);

        const stockButton = document.createElement("button");
        stockButton.textContent = isInStock
          ? "Mark Out of Stock"
          : "Mark In Stock";

        stockButton.addEventListener("click", async () => {
          try {
            await updateDoc(doc(db, "products", docSnap.id), {
              inStock: !isInStock
            });
            message.textContent = "Product Stock अपडेट हो गया।";
            await window.loadSellerDashboard();
          } catch (error) {
            alert("Stock Update Error: " + error.message);
          }
        });

        card.appendChild(stockButton);
      }

      if (product.status === "pending" || product.status === "approved") {
        const editButton = document.createElement("button");
        editButton.textContent = "✏️ Edit Product";
        editButton.addEventListener("click", () => {
          editingSellerProductId = docSnap.id;
          editingSellerProductImage = product.image || "";

          document.getElementById("sellerProductName").value = product.name || "";
          document.getElementById("sellerProductPrice").value = product.price || "";
          document.getElementById("sellerProductEmoji").value = product.emoji || "";
          document.getElementById("sellerProductCategory").value = product.category || "";
          document.getElementById("sellerProductDescription").value = product.description || "";

          const preview = document.getElementById("sellerProductImagePreview");
          if (product.image) {
            preview.src = product.image;
            preview.style.display = "block";
          }

          document.getElementById("sellerProductImage").value = "";
          document.getElementById("sellerSubmitButton").textContent = "Update Product";
          document.getElementById("sellerCancelEdit").style.display = "inline-block";
          document.getElementById("sellerProductMessage").textContent = "अब बदलाव करें और Update Product दबाएँ।";
          document.getElementById("sellerProductName").scrollIntoView({ behavior: "smooth" });
        });
        card.appendChild(editButton);
      }

      if (product.status === "pending") {
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "🗑️ Delete Product";
        deleteButton.style.marginLeft = "8px";

        deleteButton.addEventListener("click", async () => {
          if (!confirm("क्या आप यह Pending Product Delete करना चाहते हैं?")) return;

          try {
            await deleteDoc(doc(db, "products", docSnap.id));
            document.getElementById("sellerProductMessage").textContent =
              "Product सफलतापूर्वक Delete हो गया।";
            await window.loadSellerDashboard();
          } catch (error) {
            alert("Delete Error: " + error.message);
          }
        });

        card.appendChild(deleteButton);
      }

      list.appendChild(card);
    });

    document.getElementById("sellerTotalProducts").textContent = snapshot.size;
    document.getElementById("sellerPendingProducts").textContent = pending;
    document.getElementById("sellerApprovedProducts").textContent = approved;

    message.textContent = snapshot.empty
      ? "अभी आपने कोई प्रोडक्ट नहीं जोड़ा है।"
      : "आपके प्रोडक्ट लोड हो गए हैं।";

  } catch (error) {
    console.error("Seller Dashboard Error:", error);
    message.textContent = "Dashboard त्रुटि: " + error.message;
  }
};

// CANCEL SELLER PRODUCT EDIT
window.cancelSellerProductEdit = function() {
  editingSellerProductId = null;
  editingSellerProductImage = "";

  document.getElementById("sellerProductName").value = "";
  document.getElementById("sellerProductPrice").value = "";
  document.getElementById("sellerProductEmoji").value = "";
  document.getElementById("sellerProductCategory").value = "";
  document.getElementById("sellerProductDescription").value = "";
  document.getElementById("sellerProductImage").value = "";
  document.getElementById("sellerProductImagePreview").style.display = "none";
  document.getElementById("sellerImageUploadMessage").textContent = "";
  document.getElementById("sellerSubmitButton").textContent = "Submit Product for Approval";
  document.getElementById("sellerCancelEdit").style.display = "none";
  document.getElementById("sellerProductMessage").textContent = "Edit रद्द कर दिया गया।";
};

// SELLER LOGOUT
window.sellerLogout = async function() {
  await signOut(auth);
  document.getElementById("sellerPanel").style.display = "none";
  document.getElementById("sellerRegistration").style.display = "block";
  document.getElementById("sellerLoginMessage").textContent = "Logout हो गया।";
};


// ADMIN: SELLER APPLICATIONS
window.loadSellerApplications = async function() {
  const box = document.getElementById("sellerApplications");
  if (!box) return;

  try {
    const snapshot = await getDocs(
      query(collection(db, "sellerApplications"), where("status", "==", "pending"))
    );

    box.innerHTML = "";
    if (snapshot.empty) {
      box.textContent = "कोई Pending Seller Application नहीं है।";
      return;
    }

    snapshot.forEach(applicationDoc => {
      const data = applicationDoc.data();
      const item = document.createElement("div");
      item.className = "cartitem";

      const details = document.createElement("p");
      details.textContent =
        (data.shopName || "Shop") + " — " +
        (data.ownerName || "Owner") + " — " +
        (data.email || "");

      const button = document.createElement("button");
      button.textContent = "Approve Seller";
      button.onclick = () => window.approveSeller(applicationDoc.id);

      item.append(details, button);
      box.appendChild(item);
    });
  } catch (error) {
    box.textContent = "Applications Error: " + error.message;
  }
};

window.approveSeller = async function(uid) {
  try {
    await updateDoc(doc(db, "sellerApplications", uid), {
      status: "approved"
    });
    alert("Seller Approved!");
    window.loadSellerApplications();
  } catch (error) {
    alert("Seller Approval Error: " + error.message);
  }
};

// ADMIN: DELIVERY BOY APPLICATIONS
window.loadDeliveryApplications = async function() {
  const box = document.getElementById("deliveryApplications");
  const msg = document.getElementById("deliveryAdminMessage");
  if (!box) return;

  try {
    const user = auth.currentUser;
    if (!user) {
      msg.textContent = "पहले Admin Login करें।";
      return;
    }

    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      msg.textContent = "केवल Admin यह काम कर सकता है।";
      return;
    }

    const snapshot = await getDocs(
      query(
        collection(db, "deliveryApplications"),
        where("status", "==", "pending")
      )
    );

    box.replaceChildren();

    if (snapshot.empty) {
      msg.textContent = "कोई Pending Delivery Boy Application नहीं है।";
      return;
    }

    snapshot.forEach(applicationDoc => {
      const data = applicationDoc.data();
      const item = document.createElement("div");
      item.className = "cartitem";

      const details = document.createElement("p");
      details.textContent =
        (data.name || "नाम उपलब्ध नहीं") + " — " +
        (data.phone || "मोबाइल उपलब्ध नहीं") + " — " +
        (data.email || "");

      const approve = document.createElement("button");
      approve.textContent = "Approve";
      approve.onclick = () => window.reviewDeliveryApplication(
        applicationDoc.id, "approved"
      );

      const reject = document.createElement("button");
      reject.textContent = "Reject";
      reject.style.marginLeft = "8px";
      reject.onclick = () => window.reviewDeliveryApplication(
        applicationDoc.id, "rejected"
      );

      item.append(details, approve, reject);
      box.appendChild(item);
    });

    msg.textContent = "Pending Applications: " + snapshot.size;
  } catch (error) {
    msg.textContent = "Applications Error: " + error.message;
  }
};

window.reviewDeliveryApplication = async function(uid, decision) {
  if (!["approved", "rejected"].includes(decision)) return;

  const user = auth.currentUser;
  if (!user) {
    alert("पहले Admin Login करें।");
    return;
  }

  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      alert("केवल Admin यह काम कर सकता है।");
      return;
    }

    const applicationRef = doc(db, "deliveryApplications", uid);
    const applicationSnap = await getDoc(applicationRef);

    if (!applicationSnap.exists() ||
        applicationSnap.data().status !== "pending") {
      alert("यह Application अब Pending नहीं है।");
      await window.loadDeliveryApplications();
      return;
    }

    await updateDoc(applicationRef, {
      status: decision,
      reviewedAt: serverTimestamp()
    });

    alert(decision === "approved"
      ? "Delivery Boy Approved!"
      : "Delivery Boy Application Rejected!");

    await window.loadDeliveryApplications();
  } catch (error) {
    alert("Delivery Application Error: " + error.message);
  }
};

// ADMIN: APPROVE SELLER PRODUCT
window.approveSellerProduct = async function(productId) {
  try {
    await updateDoc(doc(db, "products", productId), {
      status: "approved"
    });
    alert("Product Approved!");
    window.loadAdminProducts();
  } catch (error) {
    alert("Product Approval Error: " + error.message);
  }
};

// ADMIN: CUSTOMER ORDERS
window.adminOrdersData = [];

window.loadAdminOrders = async function() {
  const box = document.getElementById("adminOrders");
  if (!box) return;

  box.textContent = "Orders लोड हो रहे हैं...";

  try {
    const snapshot = await getDocs(collection(db, "orders"));

    const deliverySnapshot = await getDocs(
      query(
        collection(db, "deliveryApplications"),
        where("status", "==", "approved")
      )
    );

    window.approvedDeliveryBoys = deliverySnapshot.docs.map(d => ({
      uid: d.id,
      name: d.data().name || "Delivery Boy",
      phone: d.data().phone || ""
    }));

    const counts = {
      new: 0,
      confirmed: 0,
      packed: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0
    };

    snapshot.forEach(docSnap => {
      const status = docSnap.data().status || "new";
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status]++;
      }
    });

    const summary = document.getElementById("adminOrderSummary");
    if (summary) {
      summary.innerHTML =
        "<p>कुल ऑर्डर: <b>" + snapshot.size + "</b></p>" +
        "<p>New: " + counts.new +
        " | Confirmed: " + counts.confirmed +
        " | Packed: " + counts.packed + "</p>" +
        "<p>Out for Delivery: " + counts.out_for_delivery +
        " | Delivered: " + counts.delivered +
        " | Cancelled: " + counts.cancelled + "</p>";
    }

    window.adminOrdersData = snapshot.docs.map(orderDoc => ({
      id: orderDoc.id,
      data: orderDoc.data()
    }));

    window.filterAdminOrders();

  } catch (error) {
    box.textContent = "Orders Error: " + error.message;
  }
};

window.filterAdminOrders = function() {
  const box = document.getElementById("adminOrders");
  if (!box) return;

  const search = (document.getElementById("adminOrderSearch")?.value || "").toLowerCase().trim();
  const statusFilter = document.getElementById("adminOrderStatusFilter")?.value || "all";

  const filtered = window.adminOrdersData.filter(order => {
    const data = order.data;
    const orderStatus = data.status || "new";

    const searchableText = [
      order.id,
      data.customerName || "",
      data.customerPhone || ""
    ].join(" ").toLowerCase();

    return searchableText.includes(search) &&
      (statusFilter === "all" || orderStatus === statusFilter);
  });

  box.innerHTML = "";

  if (filtered.length === 0) {
    box.textContent = window.adminOrdersData.length === 0
      ? "अभी कोई Customer Order नहीं आया है।"
      : "इस Search या Status में कोई Order नहीं मिला।";
    return;
  }

  filtered.forEach(order => {
    const data = order.data;
    const item = document.createElement("div");
    item.className = "cartitem";

    const details = document.createElement("p");
    details.textContent =
      "Order ID: " + order.id +
      "\nग्राहक: " + (data.customerName || "") +
      "\nमोबाइल: " + (data.customerPhone || "") +
      "\nपता: " + (data.customerAddress || "") +
      "\nसामान: " + (data.items || "") +
      "\nकुल कीमत: ₹" + (data.total || 0) +
      "\nPayment: " + (data.payment || "") +
      "\nStatus: " + (data.status || "new");

    item.appendChild(details);

    const select = document.createElement("select");
    [
      ["new", "New"],
      ["confirmed", "Confirmed"],
      ["packed", "Packed"],
      ["out_for_delivery", "Out for Delivery"],
      ["delivered", "Delivered"],
      ["cancelled", "Cancelled"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if ((data.status || "new") === value) option.selected = true;
      select.appendChild(option);
    });

    const button = document.createElement("button");
    button.textContent = "Update Order Status";
    button.onclick = async () => {
      try {
        await updateDoc(doc(db, "orders", order.id), {
          status: select.value
        });
        alert("Order Status अपडेट हो गया।");
        window.loadAdminOrders();
      } catch (error) {
        alert("Status Error: " + error.message);
      }
    };

    const assignedInfo = document.createElement("p");
    assignedInfo.textContent = "Assigned Delivery Boy: " +
      (data.deliveryBoyName || "अभी Assign नहीं हुआ");
    item.appendChild(assignedInfo);

    const deliverySelect = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Delivery Boy चुनें";
    deliverySelect.appendChild(placeholder);

    const deliveryBoys = window.approvedDeliveryBoys || [];

    deliveryBoys.forEach(boy => {
      const option = document.createElement("option");
      option.value = boy.uid;
      option.textContent = boy.name + (boy.phone ? " - " + boy.phone : "");
      if (data.deliveryBoyUid === boy.uid) option.selected = true;
      deliverySelect.appendChild(option);
    });

    if (deliveryBoys.length === 0) {
      placeholder.textContent = "कोई Approved Delivery Boy नहीं है";
    }

    const assignButton = document.createElement("button");
    assignButton.textContent = "Assign Delivery Boy";
    assignButton.disabled = data.status !== "packed" || deliveryBoys.length === 0;

    assignButton.onclick = async () => {
      const selectedUid = deliverySelect.value;
      const selectedBoy = deliveryBoys.find(boy => boy.uid === selectedUid);

      if (!selectedBoy) {
        alert("पहले Delivery Boy चुनें।");
        return;
      }

      if (data.status !== "packed") {
        alert("Delivery Boy केवल Packed Order पर Assign कर सकते हैं।");
        return;
      }

      try {
        await updateDoc(doc(db, "orders", order.id), {
          deliveryBoyUid: selectedBoy.uid,
          deliveryBoyName: selectedBoy.name,
          deliveryAssignedAt: serverTimestamp()
        });
        alert("Delivery Boy सफलतापूर्वक Assign हो गया।");
        window.loadAdminOrders();
      } catch (error) {
        alert("Assign Error: " + error.message);
      }
    };

    item.append(select, button, deliverySelect, assignButton);
    box.appendChild(item);
  });
};

// CUSTOMER ORDER SAVE TO FIREBASE
window.saveCustomerOrder = async function(order) {
  return await addDoc(collection(db, "orders"), {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    items: order.items,
    orderLines: order.orderLines || [],
    total: order.total,
    payment: order.payment,
    status: "new",
    createdAt: serverTimestamp()
  });
};

// SELLER SALES AND 10% COMMISSION REPORT
window.loadSellerCommissionReport = async function() {
  const box = document.getElementById("sellerCommissionReport");
  if (!box) return;

  box.textContent = "Commission Report लोड हो रही है...";

  try {
    const snapshot = await getDocs(collection(db, "orders"));
    const sellerSnapshot = await getDocs(collection(db, "sellerApplications"));
    const sellerNames = {};

    sellerSnapshot.forEach(docSnap => {
      const seller = docSnap.data();
      if (seller.uid) {
        sellerNames[seller.uid] = seller.shopName || seller.ownerName || "Unknown Seller";
      }
    });
    const sellers = {};
    let totalSales = 0;
    let totalCommission = 0;
    let totalSellerAmount = 0;
    let todaySales = 0;
    let todayOrders = 0;

    const todayKey = new Date().toLocaleDateString("en-CA");

    snapshot.forEach(orderDoc => {
      const order = orderDoc.data();

      if (order.status === "cancelled") return;

      const orderDate = order.createdAt && typeof order.createdAt.toDate === "function"
        ? order.createdAt.toDate()
        : null;
      const orderDateKey = orderDate
        ? orderDate.toLocaleDateString("en-CA")
        : "";

      if (orderDateKey === todayKey) todayOrders++;

      if (!Array.isArray(order.orderLines)) return;

      order.orderLines.forEach(line => {
        const sellerId = line.sellerId || "admin";
        const amount = Number(line.lineTotal) || 0;
        const commission = Math.round(amount * 10) / 100;
        const sellerAmount = amount - commission;

        if (!sellers[sellerId]) {
          sellers[sellerId] = {
            sales: 0,
            commission: 0,
            sellerAmount: 0,
            orders: 0
          };
        }

        sellers[sellerId].sales += amount;
        sellers[sellerId].commission += commission;
        sellers[sellerId].sellerAmount += sellerAmount;
        sellers[sellerId].orders += 1;

        totalSales += amount;
        totalCommission += commission;
        totalSellerAmount += sellerAmount;

        if (orderDateKey === todayKey) {
          todaySales += amount;
        }
      });
    });

    box.innerHTML = "";

    const summary = document.createElement("div");
    summary.className = "cartitem";
    summary.textContent =
      "आज के कुल ऑर्डर: " + todayOrders +
      "\\nआज की बिक्री: ₹" + todaySales.toFixed(2) +
      "\\nअब तक की कुल बिक्री: ₹" + totalSales.toFixed(2) +
      "\\nPatnaKart कुल कमीशन (10%): ₹" + totalCommission.toFixed(2) +
      "\\nSeller कुल हिस्सा (90%): ₹" + totalSellerAmount.toFixed(2);

    box.appendChild(summary);

    if (Object.keys(sellers).length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "अभी Seller-wise ऑर्डर नहीं मिले।";
      box.appendChild(empty);
      return;
    }

    Object.entries(sellers).forEach(([sellerId, data]) => {
      const card = document.createElement("div");
      card.className = "cartitem";

      const details = document.createElement("p");
      details.textContent =
        "दुकान का नाम: " + (sellerNames[sellerId] || sellerId) +
        "\nकुल बिक्री: ₹" + data.sales.toFixed(2) +
        "\nPatnaKart कमीशन: ₹" + data.commission.toFixed(2) +
        "\nSeller का हिस्सा: ₹" + data.sellerAmount.toFixed(2) +
        "\nOrder Lines: " + data.orders;

      card.appendChild(details);
      box.appendChild(card);
    });

  } catch (error) {
    box.textContent = "Commission Report Error: " + error.message;
  }
};

// DOWNLOAD SELLER COMMISSION CSV REPORT
window.downloadCommissionCSV = async function() {
  try {
    const snapshot = await getDocs(collection(db, "orders"));
    const sellerSnapshot = await getDocs(collection(db, "sellerApplications"));

    const sellerNames = {};
    sellerSnapshot.forEach(docSnap => {
      const seller = docSnap.data();
      if (seller.uid) {
        sellerNames[seller.uid] =
          seller.shopName || seller.ownerName || "Unknown Seller";
      }
    });

    const startValue = document.getElementById("commissionStartDate")?.value || "";
    const endValue = document.getElementById("commissionEndDate")?.value || "";

    if (startValue && endValue && startValue > endValue) {
      alert("आखिरी तारीख, शुरुआती तारीख से पहले नहीं हो सकती।");
      return;
    }

    const sellers = {};
    let totalSales = 0;
    let totalCommission = 0;
    let totalSellerAmount = 0;

    snapshot.forEach(orderDoc => {
      const order = orderDoc.data();
      if (order.status === "cancelled") return;

      const orderDate = order.createdAt && typeof order.createdAt.toDate === "function"
        ? order.createdAt.toDate()
        : null;
      if (!orderDate) return;

      const dateKey = [
        orderDate.getFullYear(),
        String(orderDate.getMonth() + 1).padStart(2, "0"),
        String(orderDate.getDate()).padStart(2, "0")
      ].join("-");

      if (startValue && dateKey < startValue) return;
      if (endValue && dateKey > endValue) return;
      if (!Array.isArray(order.orderLines)) return;

      order.orderLines.forEach(line => {
        const sellerId = line.sellerId || "admin";
        const amount = Number(line.lineTotal) || 0;
        const commission = Math.round(amount * 10) / 100;
        const sellerAmount = amount - commission;

        if (!sellers[sellerId]) {
          sellers[sellerId] = {
            sales: 0,
            commission: 0,
            sellerAmount: 0,
            orders: 0
          };
        }

        sellers[sellerId].sales += amount;
        sellers[sellerId].commission += commission;
        sellers[sellerId].sellerAmount += sellerAmount;
        sellers[sellerId].orders++;

        totalSales += amount;
        totalCommission += commission;
        totalSellerAmount += sellerAmount;
      });
    });

    const rows = [
      ["PatnaKart Sales & Commission Report"],
      ["दुकान का नाम", "कुल बिक्री", "10% कमीशन", "Seller का 90% हिस्सा", "Order Lines"]
    ];

    Object.entries(sellers).forEach(([sellerId, data]) => {
      rows.push([
        sellerNames[sellerId] || sellerId,
        data.sales.toFixed(2),
        data.commission.toFixed(2),
        data.sellerAmount.toFixed(2),
        data.orders
      ]);
    });

    rows.push([]);
    rows.push([
      "कुल",
      totalSales.toFixed(2),
      totalCommission.toFixed(2),
      totalSellerAmount.toFixed(2),
      ""
    ]);

    const csv = "\uFEFF" + rows.map(row =>
      row.map(value =>
        '"' + String(value).replace(/"/g, '""') + '"'
      ).join(",")
    ).join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "PatnaKart_Commission_Report_" + (startValue || "All") + "_to_" + (endValue || "All") + "_" +
      new Date().toISOString().slice(0, 10) + ".csv";

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    alert("CSV Report डाउनलोड शुरू हो गया।");

  } catch (error) {
    alert("CSV Download Error: " + error.message);
  }
};

// DATE-WISE COMMISSION REPORT
window.loadSellerCommissionReport = async function() {
  const box = document.getElementById("sellerCommissionReport");
  if (!box) return;

  const startValue = document.getElementById("commissionStartDate")?.value || "";
  const endValue = document.getElementById("commissionEndDate")?.value || "";

  if (startValue && endValue && startValue > endValue) {
    box.textContent = "आखिरी तारीख, शुरुआती तारीख से पहले नहीं हो सकती।";
    return;
  }

  box.textContent = "Date-wise Report लोड हो रही है...";

  try {
    const snapshot = await getDocs(collection(db, "orders"));
    const sellerSnapshot = await getDocs(collection(db, "sellerApplications"));

    const sellerNames = {};
    sellerSnapshot.forEach(docSnap => {
      const seller = docSnap.data();
      if (seller.uid) {
        sellerNames[seller.uid] = seller.shopName || seller.ownerName || "Unknown Seller";
      }
    });

    const sellers = {};
    let totalSales = 0;
    let totalCommission = 0;
    let totalSellerAmount = 0;
    let totalOrders = 0;

    snapshot.forEach(orderDoc => {
      const order = orderDoc.data();
      if (order.status === "cancelled") return;

      const orderDate = order.createdAt && typeof order.createdAt.toDate === "function"
        ? order.createdAt.toDate()
        : null;
      if (!orderDate) return;

      const dateKey = [
        orderDate.getFullYear(),
        String(orderDate.getMonth() + 1).padStart(2, "0"),
        String(orderDate.getDate()).padStart(2, "0")
      ].join("-");

      if (startValue && dateKey < startValue) return;
      if (endValue && dateKey > endValue) return;

      if (!Array.isArray(order.orderLines)) return;
      totalOrders++;

      order.orderLines.forEach(line => {
        const sellerId = line.sellerId || "admin";
        const amount = Number(line.lineTotal) || 0;
        const commission = Math.round(amount * 10) / 100;
        const sellerAmount = amount - commission;

        if (!sellers[sellerId]) {
          sellers[sellerId] = { sales: 0, commission: 0, sellerAmount: 0, orders: 0 };
        }

        sellers[sellerId].sales += amount;
        sellers[sellerId].commission += commission;
        sellers[sellerId].sellerAmount += sellerAmount;
        sellers[sellerId].orders++;

        totalSales += amount;
        totalCommission += commission;
        totalSellerAmount += sellerAmount;
      });
    });

    box.innerHTML = "";

    const summary = document.createElement("div");
    summary.className = "cartitem";
    summary.textContent =
      "चुनी हुई अवधि: " + (startValue || "शुरुआत से") + " से " + (endValue || "आज तक") +
      "\nकुल ऑर्डर: " + totalOrders +
      "\nकुल बिक्री: ₹" + totalSales.toFixed(2) +
      "\nPatnaKart कमीशन (10%): ₹" + totalCommission.toFixed(2) +
      "\nSeller का हिस्सा (90%): ₹" + totalSellerAmount.toFixed(2);
    box.appendChild(summary);

    if (Object.keys(sellers).length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "इस तारीख की अवधि में कोई ऑर्डर नहीं मिला।";
      box.appendChild(empty);
      return;
    }

    Object.entries(sellers).forEach(([sellerId, data]) => {
      const card = document.createElement("div");
      card.className = "cartitem";
      const details = document.createElement("p");
      details.textContent =
        "दुकान का नाम: " + (sellerNames[sellerId] || sellerId) +
        "\nकुल बिक्री: ₹" + data.sales.toFixed(2) +
        "\nPatnaKart कमीशन: ₹" + data.commission.toFixed(2) +
        "\nSeller का हिस्सा: ₹" + data.sellerAmount.toFixed(2) +
        "\nOrder Lines: " + data.orders;
      card.appendChild(details);
      box.appendChild(card);
    });
  } catch (error) {
    box.textContent = "Date-wise Report Error: " + error.message;
  }
};

// ADMIN: CREATE PRIVATE SELLER ORDER RECORDS
window.createSellerOrders = async function() {
  const message = document.getElementById("sellerOrderAdminMessage");
  const user = auth.currentUser;

  if (!user) {
    message.textContent = "पहले Admin Login करें।";
    return;
  }

  message.textContent = "Seller Orders बनाए जा रहे हैं...";

  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));

    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      message.textContent = "केवल Admin यह काम कर सकता है।";
      return;
    }

    const ordersSnap = await getDocs(collection(db, "orders"));
    let created = 0;

    for (const orderDoc of ordersSnap.docs) {
      const order = orderDoc.data();
      if (!Array.isArray(order.orderLines)) continue;

      const sellerGroups = {};

      order.orderLines.forEach(line => {
        const sellerId = line.sellerId;
        if (!sellerId || sellerId === "admin") return;

        if (!sellerGroups[sellerId]) sellerGroups[sellerId] = [];

        sellerGroups[sellerId].push({
          productId: line.productId || "",
          productName: line.productName || "Product",
          quantity: Number(line.quantity || 0),
          unitPrice: Number(line.unitPrice || 0),
          lineTotal: Number(line.lineTotal || 0)
        });
      });

      for (const [sellerId, items] of Object.entries(sellerGroups)) {
        const sellerOrderId = orderDoc.id + "_" + sellerId;
        const sellerOrderRef = doc(db, "sellerOrders", sellerOrderId);
        const existing = await getDoc(sellerOrderRef);

        const record = {
          orderId: orderDoc.id,
          sellerId: sellerId,
          items: items,
          total: items.reduce((sum, item) => sum + item.lineTotal, 0),
          updatedAt: serverTimestamp()
        };

        if (!existing.exists()) {
          record.status = order.status === "cancelled" ? "cancelled" : "new";
          record.createdAt = serverTimestamp();
        }

        await setDoc(sellerOrderRef, record, { merge: true });
        created++;
      }
    }

    message.textContent =
      "काम पूरा हुआ। Seller Order रिकॉर्ड जाँचे/बनाए गए: " + created;

  } catch (error) {
    console.error("Seller Order Creation Error:", error);
    message.textContent = "त्रुटि: " + error.message;
  }
};

// SELLER: LOAD MY PRIVATE ORDERS
window.loadSellerOrders = async function() {
  const user = auth.currentUser;
  const message = document.getElementById("sellerOrdersMessage");
  const list = document.getElementById("sellerOrdersList");

  if (!user || !message || !list) return;

  message.textContent = "आपके ऑर्डर लोड हो रहे हैं...";
  list.replaceChildren();

  try {
    const q = query(
      collection(db, "sellerOrders"),
      where("sellerId", "==", user.uid)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      message.textContent = "अभी आपके कोई ऑर्डर नहीं हैं।";
      return;
    }

    snapshot.forEach(orderDoc => {
      const order = orderDoc.data();
      const card = document.createElement("div");
      card.className = "cartitem";

      const details = document.createElement("p");
      details.textContent =
        "Order ID: " + (order.orderId || orderDoc.id) +
        "\nसामान:\n" +
        (order.items || []).map(item =>
          item.productName + " × " + item.quantity +
          " = ₹" + item.lineTotal
        ).join("\n") +
        "\nकुल कीमत: ₹" + (order.total || 0) +
        "\nस्थिति: " + (order.status || "new");

      card.appendChild(details);

      const select = document.createElement("select");
      [
        ["confirmed", "Confirmed"],
        ["packed", "Packed"],
        ["out_for_delivery", "Out for Delivery"],
        ["delivered", "Delivered"]
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        if ((order.status || "new") === value) option.selected = true;
        select.appendChild(option);
      });

      if (order.status === "cancelled") {
        select.disabled = true;
      }

      const button = document.createElement("button");
      button.textContent = "Update Order Status";

      button.onclick = async () => {
        try {
          await updateDoc(doc(db, "sellerOrders", orderDoc.id), {
            status: select.value
          });

          message.textContent = "ऑर्डर की स्थिति अपडेट हो गई।";
          await window.loadSellerOrders();
        } catch (error) {
          alert("Order Status Error: " + error.message);
        }
      };

      card.append(select, button);
      list.appendChild(card);
    });

    message.textContent = "आपके " + snapshot.size + " ऑर्डर लोड हो गए।";

  } catch (error) {
    console.error("Seller Orders Error:", error);
    message.textContent = "Orders Error: " + error.message;
  }
};

// ADMIN: SYNC SELLER ORDER STATUSES TO MAIN ORDERS
window.syncSellerOrderStatuses = async function() {
  const message = document.getElementById("sellerOrderAdminMessage");
  const user = auth.currentUser;

  if (!user) {
    message.textContent = "पहले Admin Login करें।";
    return;
  }

  message.textContent = "Seller Status Sync हो रहा है...";

  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));

    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      message.textContent = "केवल Admin यह काम कर सकता है।";
      return;
    }

    const [mainSnap, sellerSnap] = await Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "sellerOrders"))
    ]);

    const sellerGroups = {};

    sellerSnap.forEach(sellerDoc => {
      const data = sellerDoc.data();
      if (!data.orderId) return;

      if (!sellerGroups[data.orderId]) {
        sellerGroups[data.orderId] = [];
      }

      sellerGroups[data.orderId].push(data.status || "new");
    });

    const rank = {
      new: 0,
      confirmed: 1,
      packed: 2,
      out_for_delivery: 3,
      delivered: 4
    };

    let updated = 0;

    for (const orderDoc of mainSnap.docs) {
      const current = orderDoc.data();
      const statuses = sellerGroups[orderDoc.id];

      if (!statuses || statuses.length === 0) continue;
      if (current.status === "cancelled") continue;

      // सभी Seller का Status एक ही चरण तक पहुँचना चाहिए।
      const activeStatuses = statuses.filter(status => status !== "cancelled");
      if (activeStatuses.length === 0) continue;

      const validStatuses = activeStatuses.filter(status =>
        Object.prototype.hasOwnProperty.call(rank, status)
      );

      if (validStatuses.length !== activeStatuses.length) continue;

      const lowestRank = Math.min(...validStatuses.map(status => rank[status]));
      const nextStatus = Object.keys(rank).find(status => rank[status] === lowestRank);

      const currentStatus = current.status || "new";
      const currentRank = rank[currentStatus];

      if (
        Number.isInteger(currentRank) &&
        rank[nextStatus] > currentRank
      ) {
        await updateDoc(doc(db, "orders", orderDoc.id), {
          status: nextStatus
        });
        updated++;
      }
    }

    message.textContent =
      "Sync पूरा हुआ। मुख्य Orders अपडेट: " + updated;

    await window.loadAdminOrders();

  } catch (error) {
    console.error("Seller Status Sync Error:", error);
    message.textContent = "Sync Error: " + error.message;
  }
};

// ADMIN: SELLER-WISE ORDER REPORT
window.loadSellerWiseOrderReport = async function() {
  const box = document.getElementById("sellerWiseOrderReport");
  const message = document.getElementById("sellerWiseReportMessage");
  const user = auth.currentUser;

  if (!box || !message) return;

  if (!user) {
    message.textContent = "पहले Admin Login करें।";
    return;
  }

  message.textContent = "Seller-wise Report लोड हो रही है...";
  box.replaceChildren();

  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));

    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      message.textContent = "केवल Admin यह रिपोर्ट देख सकता है।";
      return;
    }

    const [sellerSnap, orderSnap] = await Promise.all([
      getDocs(collection(db, "sellerApplications")),
      getDocs(collection(db, "sellerOrders"))
    ]);

    const sellerNames = {};

    sellerSnap.forEach(sellerDoc => {
      const seller = sellerDoc.data();
      if (seller.uid) {
        sellerNames[seller.uid] =
          seller.shopName || seller.ownerName || "Unknown Seller";
      }
    });

    const sellers = {};

    orderSnap.forEach(orderDoc => {
      const order = orderDoc.data();
      const sellerId = order.sellerId;
      if (!sellerId) return;

      if (!sellers[sellerId]) {
        sellers[sellerId] = {
          name: sellerNames[sellerId] || "Unknown Seller",
          sales: 0,
          orders: 0,
          statuses: {
            new: 0,
            confirmed: 0,
            packed: 0,
            out_for_delivery: 0,
            delivered: 0,
            cancelled: 0
          },
          records: []
        };
      }

      const status = order.status || "new";
      const total = Number(order.total) || 0;

      sellers[sellerId].sales += total;
      sellers[sellerId].orders++;

      if (Object.prototype.hasOwnProperty.call(
        sellers[sellerId].statuses, status
      )) {
        sellers[sellerId].statuses[status]++;
      }

      sellers[sellerId].records.push({
        orderId: order.orderId || orderDoc.id,
        status: status,
        total: total,
        items: Array.isArray(order.items) ? order.items : []
      });
    });

    const sellerIds = Object.keys(sellers);

    if (sellerIds.length === 0) {
      message.textContent = "अभी कोई Seller Order उपलब्ध नहीं है।";
      return;
    }

    sellerIds.sort((a, b) =>
      sellers[a].name.localeCompare(sellers[b].name)
    );

    let totalOrders = 0;
    let totalSales = 0;

    sellerIds.forEach(sellerId => {
      const seller = sellers[sellerId];
      totalOrders += seller.orders;
      totalSales += seller.sales;

      const card = document.createElement("div");
      card.className = "cartitem";

      const heading = document.createElement("h3");
      heading.textContent = "🏪 " + seller.name;
      card.appendChild(heading);

      const summary = document.createElement("p");
      summary.textContent =
        "कुल ऑर्डर: " + seller.orders +
        "\nकुल बिक्री: ₹" + seller.sales +
        "\nNew: " + seller.statuses.new +
        " | Confirmed: " + seller.statuses.confirmed +
        " | Packed: " + seller.statuses.packed +
        "\nOut for Delivery: " + seller.statuses.out_for_delivery +
        " | Delivered: " + seller.statuses.delivered +
        " | Cancelled: " + seller.statuses.cancelled;

      card.appendChild(summary);

      seller.records.forEach(record => {
        const details = document.createElement("p");
        const itemText = record.items.map(item =>
          (item.productName || "Product") +
          " × " + (Number(item.quantity) || 0)
        ).join(", ");

        details.textContent =
          "\nOrder ID: " + record.orderId +
          "\nसामान: " + itemText +
          "\nराशि: ₹" + record.total +
          "\nStatus: " + record.status;

        card.appendChild(details);
      });

      box.appendChild(card);
    });

    message.textContent =
      "रिपोर्ट तैयार। कुल Seller: " + sellerIds.length +
      " | कुल Seller Orders: " + totalOrders +
      " | कुल बिक्री: ₹" + totalSales;

  } catch (error) {
    console.error("Seller-wise Report Error:", error);
    message.textContent = "Report Error: " + error.message;
  }
};

// ADMIN: DOWNLOAD SELLER-WISE CSV
window.downloadSellerWiseCSV = async function() {
  const message = document.getElementById("sellerWiseReportMessage");
  const user = auth.currentUser;

  if (!user) {
    message.textContent = "पहले Admin Login करें।";
    return;
  }

  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));

    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      message.textContent = "केवल Admin CSV डाउनलोड कर सकता है।";
      return;
    }

    const [sellerSnap, orderSnap] = await Promise.all([
      getDocs(collection(db, "sellerApplications")),
      getDocs(collection(db, "sellerOrders"))
    ]);

    const sellerNames = {};

    sellerSnap.forEach(sellerDoc => {
      const seller = sellerDoc.data();
      if (seller.uid) {
        sellerNames[seller.uid] =
          seller.shopName || seller.ownerName || "Unknown Seller";
      }
    });

    const rows = [[
      "Seller Name",
      "Order ID",
      "Products",
      "Quantity",
      "Amount INR",
      "Status"
    ]];

    orderSnap.forEach(orderDoc => {
      const order = orderDoc.data();
      const sellerId = order.sellerId;
      if (!sellerId) return;

      const items = Array.isArray(order.items) ? order.items : [];
      const products = items.map(item =>
        (item.productName || "Product") +
        " x " + (Number(item.quantity) || 0)
      ).join("; ");

      const quantity = items.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0), 0
      );

      rows.push([
        sellerNames[sellerId] || "Unknown Seller",
        order.orderId || orderDoc.id,
        products,
        quantity,
        Number(order.total) || 0,
        order.status || "new"
      ]);
    });

    if (rows.length === 1) {
      message.textContent = "डाउनलोड के लिए कोई Seller Order नहीं मिला।";
      return;
    }

    const csv = "\uFEFF" + rows.map(row =>
      row.map(value =>
        '"' + String(value).replace(/"/g, '""') + '"'
      ).join(",")
    ).join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      "PatnaKart_Seller_Wise_Report_" +
      new Date().toISOString().slice(0, 10) + ".csv";

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    message.textContent = "Seller-wise CSV डाउनलोड शुरू हो गया।";

  } catch (error) {
    console.error("Seller-wise CSV Error:", error);
    message.textContent = "CSV Error: " + error.message;
  }
};

// SELLER-WISE REPORT WITH DATE FILTER
window.loadSellerWiseOrderReport = async function() {
  const box = document.getElementById("sellerWiseOrderReport");
  const message = document.getElementById("sellerWiseReportMessage");
  const user = auth.currentUser;

  if (!box || !message) return;

  if (!user) {
    message.textContent = "पहले Admin Login करें।";
    return;
  }

  message.textContent = "रिपोर्ट लोड हो रही है...";
  box.replaceChildren();

  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));

    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      message.textContent = "केवल Admin यह रिपोर्ट देख सकता है।";
      return;
    }

    const startValue = document.getElementById("sellerWiseStartDate")?.value || "";
    const endValue = document.getElementById("sellerWiseEndDate")?.value || "";

    if (startValue && endValue && startValue > endValue) {
      message.textContent = "From Date, To Date से आगे नहीं हो सकती।";
      return;
    }

    const startDate = startValue ? new Date(startValue + "T00:00:00") : null;
    const endDate = endValue ? new Date(endValue + "T23:59:59.999") : null;

    const [sellerSnap, orderSnap] = await Promise.all([
      getDocs(collection(db, "sellerApplications")),
      getDocs(collection(db, "sellerOrders"))
    ]);

    const sellerNames = {};

    sellerSnap.forEach(sellerDoc => {
      const seller = sellerDoc.data();
      if (seller.uid) {
        sellerNames[seller.uid] =
          seller.shopName || seller.ownerName || "Unknown Seller";
      }
    });

    const sellers = {};

    orderSnap.forEach(orderDoc => {
      const order = orderDoc.data();
      if (!order.sellerId) return;

      if (startDate || endDate) {
        if (!order.createdAt || typeof order.createdAt.toDate !== "function") return;
        const created = order.createdAt.toDate();

        if (startDate && created < startDate) return;
        if (endDate && created > endDate) return;
      }

      const sellerId = order.sellerId;
      const status = order.status || "new";
      const total = Number(order.total) || 0;

      if (!sellers[sellerId]) {
        sellers[sellerId] = {
          name: sellerNames[sellerId] || "Unknown Seller",
          sales: 0,
          orders: 0,
          statuses: {
            new: 0, confirmed: 0, packed: 0,
            out_for_delivery: 0, delivered: 0, cancelled: 0
          },
          records: []
        };
      }

      const seller = sellers[sellerId];
      seller.sales += total;
      seller.orders++;

      if (Object.prototype.hasOwnProperty.call(seller.statuses, status)) {
        seller.statuses[status]++;
      }

      seller.records.push({
        orderId: order.orderId || orderDoc.id,
        status,
        total,
        items: Array.isArray(order.items) ? order.items : []
      });
    });

    const sellerIds = Object.keys(sellers).sort((a, b) =>
      sellers[a].name.localeCompare(sellers[b].name)
    );

    if (!sellerIds.length) {
      message.textContent = "चुनी हुई तारीख़ में कोई Seller Order नहीं मिला।";
      return;
    }

    let totalOrders = 0;
    let totalSales = 0;

    sellerIds.forEach(sellerId => {
      const seller = sellers[sellerId];
      totalOrders += seller.orders;
      totalSales += seller.sales;

      const card = document.createElement("div");
      card.className = "cartitem";

      const heading = document.createElement("h3");
      heading.textContent = "🏪 " + seller.name;
      card.appendChild(heading);

      const summary = document.createElement("p");
      summary.textContent =
        "कुल ऑर्डर: " + seller.orders +
        "\nकुल बिक्री: ₹" + seller.sales +
        "\nNew: " + seller.statuses.new +
        " | Confirmed: " + seller.statuses.confirmed +
        " | Packed: " + seller.statuses.packed +
        "\nOut for Delivery: " + seller.statuses.out_for_delivery +
        " | Delivered: " + seller.statuses.delivered +
        " | Cancelled: " + seller.statuses.cancelled;
      card.appendChild(summary);

      seller.records.forEach(record => {
        const details = document.createElement("p");
        const itemText = record.items.map(item =>
          (item.productName || "Product") +
          " × " + (Number(item.quantity) || 0)
        ).join(", ");

        details.textContent =
          "Order ID: " + record.orderId +
          "\nसामान: " + itemText +
          "\nराशि: ₹" + record.total +
          "\nStatus: " + record.status;
        card.appendChild(details);
      });

      box.appendChild(card);
    });

    message.textContent =
      "रिपोर्ट तैयार। कुल Seller: " + sellerIds.length +
      " | कुल Seller Orders: " + totalOrders +
      " | कुल बिक्री: ₹" + totalSales;

  } catch (error) {
    console.error("Seller-wise Report Error:", error);
    message.textContent = "Report Error: " + error.message;
  }
};

// SELLER-WISE CSV WITH DATE FILTER
window.downloadSellerWiseCSV = async function() {
  const message = document.getElementById("sellerWiseReportMessage");
  const user = auth.currentUser;

  if (!user) {
    message.textContent = "पहले Admin Login करें।";
    return;
  }

  try {
    const adminSnap = await getDoc(doc(db, "admins", user.uid));

    if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
      message.textContent = "केवल Admin CSV डाउनलोड कर सकता है।";
      return;
    }

    const startValue = document.getElementById("sellerWiseStartDate")?.value || "";
    const endValue = document.getElementById("sellerWiseEndDate")?.value || "";

    if (startValue && endValue && startValue > endValue) {
      message.textContent = "From Date, To Date से आगे नहीं हो सकती।";
      return;
    }

    const startDate = startValue ? new Date(startValue + "T00:00:00") : null;
    const endDate = endValue ? new Date(endValue + "T23:59:59.999") : null;

    const [sellerSnap, orderSnap] = await Promise.all([
      getDocs(collection(db, "sellerApplications")),
      getDocs(collection(db, "sellerOrders"))
    ]);

    const sellerNames = {};

    sellerSnap.forEach(sellerDoc => {
      const seller = sellerDoc.data();
      if (seller.uid) {
        sellerNames[seller.uid] =
          seller.shopName || seller.ownerName || "Unknown Seller";
      }
    });

    const rows = [[
      "Seller Name", "Order ID", "Products",
      "Quantity", "Amount INR", "Status"
    ]];

    orderSnap.forEach(orderDoc => {
      const order = orderDoc.data();
      if (!order.sellerId) return;

      if (startDate || endDate) {
        if (!order.createdAt || typeof order.createdAt.toDate !== "function") return;
        const created = order.createdAt.toDate();
        if (startDate && created < startDate) return;
        if (endDate && created > endDate) return;
      }

      const items = Array.isArray(order.items) ? order.items : [];
      const products = items.map(item =>
        (item.productName || "Product") +
        " x " + (Number(item.quantity) || 0)
      ).join("; ");

      const quantity = items.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0), 0
      );

      rows.push([
        sellerNames[order.sellerId] || "Unknown Seller",
        order.orderId || orderDoc.id,
        products,
        quantity,
        Number(order.total) || 0,
        order.status || "new"
      ]);
    });

    if (rows.length === 1) {
      message.textContent = "चुनी हुई तारीख़ में कोई Seller Order नहीं मिला।";
      return;
    }

    const csv = "\uFEFF" + rows.map(row =>
      row.map(value =>
        '"' + String(value).replace(/"/g, '""') + '"'
      ).join(",")
    ).join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      "PatnaKart_Seller_Wise_Report_" +
      new Date().toISOString().slice(0, 10) + ".csv";

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    message.textContent = "फ़िल्टर की गई Seller-wise CSV डाउनलोड शुरू हो गई।";

  } catch (error) {
    console.error("Seller-wise CSV Error:", error);
    message.textContent = "CSV Error: " + error.message;
  }
};

window.setSellerWisePreset = function(preset) {
  const today = new Date();

  const formatLocalDate = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  let start = new Date(today);
  const end = new Date(today);

  if (preset === "7days") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (preset !== "today") {
    return;
  }

  document.getElementById("sellerWiseStartDate").value = formatLocalDate(start);
  document.getElementById("sellerWiseEndDate").value = formatLocalDate(end);

  window.loadSellerWiseOrderReport();
};

// CUSTOMER ACCOUNT SYSTEM
window.customerRegister = async function() {
  const name = document.getElementById("customerRegName").value.trim();
  const phone = document.getElementById("customerRegPhone").value.trim();
  const email = document.getElementById("customerRegEmail").value.trim();
  const password = document.getElementById("customerRegPassword").value;
  const msg = document.getElementById("customerAccountMessage");

  if (!name || !/^[0-9]{10}$/.test(phone) || !email || password.length < 6) {
    msg.textContent = "सही नाम, 10 अंकों का मोबाइल, Email और कम से कम 6 अक्षर का Password भरें।";
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      name,
      phone,
      email,
      address: "",
      role: "customer",
      createdAt: serverTimestamp()
    });

    msg.textContent = "Customer अकाउंट सफलतापूर्वक बन गया!";
    document.getElementById("customerAccountPanel").style.display = "block";
    document.getElementById("customerWelcome").textContent = "स्वागत है, " + name;
    await window.loadCustomerProfile();
    document.getElementById("customerSignup").style.display = "none";
    document.getElementById("customerLogin").style.display = "none";

  } catch (error) {
    msg.textContent = "त्रुटि: " + error.message;
  }
};

window.customerLoginUser = async function() {
  const email = document.getElementById("customerLoginEmail").value.trim();
  const password = document.getElementById("customerLoginPassword").value;
  const msg = document.getElementById("customerAccountMessage");

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getDoc(doc(db, "users", result.user.uid));

    if (!profile.exists() || profile.data().role !== "customer") {
      await signOut(auth);
      msg.textContent = "यह Customer अकाउंट नहीं है।";
      return;
    }

    msg.textContent = "Login सफल!";
    document.getElementById("customerSignup").style.display = "none";
    document.getElementById("customerLogin").style.display = "none";
    document.getElementById("customerAccountPanel").style.display = "block";
    document.getElementById("customerWelcome").textContent =
      "स्वागत है, " + (profile.data().name || "Customer");

    await window.loadCustomerProfile();
    await window.loadMyCustomerOrders();

  } catch (error) {
    msg.textContent = "Login त्रुटि: " + error.message;
  }
};

window.customerLogout = async function() {
  await signOut(auth);
  document.getElementById("customerAccountPanel").style.display = "none";
  document.getElementById("customerSignup").style.display = "block";
  document.getElementById("customerLogin").style.display = "block";
  document.getElementById("customerAccountMessage").textContent = "आप Logout हो गए हैं।";
};

let unsubscribeCustomerOrders = null;

window.loadMyCustomerOrders = async function() {
  const box = document.getElementById("myCustomerOrders");
  const user = auth.currentUser;

  if (!box) return;

  if (unsubscribeCustomerOrders) {
    unsubscribeCustomerOrders();
    unsubscribeCustomerOrders = null;
  }

  if (!user) {
    box.textContent = "पहले Customer Login करें।";
    return;
  }

  box.textContent = "आपके ऑर्डर लोड हो रहे हैं...";

  const q = query(
    collection(db, "orders"),
    where("customerUid", "==", user.uid)
  );

  unsubscribeCustomerOrders = onSnapshot(q, (snapshot) => {
    box.replaceChildren();

    if (snapshot.empty) {
      box.textContent = "अभी आपके कोई अकाउंट वाले ऑर्डर नहीं हैं।";
      return;
    }

    const orders = [];
    snapshot.forEach(item => orders.push({id: item.id, ...item.data()}));

    orders.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    orders.forEach(order => {
      const card = document.createElement("div");
      card.className = "cartitem";

      const heading = document.createElement("strong");
      heading.textContent = "Order ID: " + order.id;

      const details = document.createElement("p");
      const orderDate = order.createdAt?.toDate
        ? order.createdAt.toDate().toLocaleString("en-IN")
        : "तारीख उपलब्ध नहीं";

      const statusNames = {
        new: "नया ऑर्डर",
        confirmed: "Confirmed",
        packed: "Packed",
        out_for_delivery: "डिलीवरी के लिए निकल गया",
        delivered: "Delivered",
        cancelled: "Cancelled"
      };

      details.textContent =
        "सामान: " + (order.items || "") +
        " | कुल कीमत: ₹" + (order.total || 0) +
        " | Payment: " + (order.payment || "उपलब्ध नहीं") +
        " | तारीख: " + orderDate +
        " | Status: " + (statusNames[order.status || "new"] || order.status);

      const stages = [
        ["new", "ऑर्डर प्राप्त हुआ"],
        ["confirmed", "Seller ने Confirm किया"],
        ["packed", "ऑर्डर Packed हुआ"],
        ["out_for_delivery", "डिलीवरी के लिए निकल गया"],
        ["delivered", "ऑर्डर Delivered हुआ"]
      ];

      const status = order.status || "new";
      const current = stages.findIndex(stage => stage[0] === status);

      const tracker = document.createElement("div");
      tracker.style.marginTop = "12px";

      if (status === "cancelled") {
        const cancelled = document.createElement("p");
        cancelled.textContent = "❌ यह ऑर्डर Cancel हो गया है।";
        tracker.appendChild(cancelled);
      } else {
        stages.forEach((stage, index) => {
          const line = document.createElement("p");
          line.textContent =
            (index <= current ? "🟢 " : "⚪ ") + stage[1];
          line.style.margin = "6px 0";
          tracker.appendChild(line);
        });
      }

      if (["new", "confirmed", "packed", "out_for_delivery"].includes(status)) {
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.textContent = "ऑर्डर कैंसिल करने की Request";
        cancelButton.addEventListener("click", () => {
          window.requestOrderCancellation(order.id);
        });
        card.appendChild(cancelButton);
      }

      card.append(heading, details, tracker);
      box.appendChild(card);
    });
  }, (error) => {
    box.textContent = "Live Orders Error: " + error.message;
  });
};

// CUSTOMER ORDER CANCELLATION REQUEST
window.requestOrderCancellation = async function(orderId) {
  const user = auth.currentUser;

  if (!user) {
    alert("पहले Customer Login करें।");
    return;
  }

  const reason = window.prompt("ऑर्डर कैंसिल करने का कारण लिखें:");
  if (reason === null) return;

  const cleanReason = reason.trim();
  if (!cleanReason || cleanReason.length > 300) {
    alert("कृपया 1 से 300 अक्षरों में कारण लिखें।");
    return;
  }

  try {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()
        || orderSnap.data().customerUid !== user.uid
        || !["new", "confirmed", "packed", "out_for_delivery"].includes(orderSnap.data().status)) {
      alert("इस ऑर्डर की Cancellation Request अभी नहीं भेजी जा सकती।");
      return;
    }

    const existing = await getDocs(query(
      collection(db, "cancellationRequests"),
      where("customerUid", "==", user.uid)
    ));

    const alreadyRequested = existing.docs.some(item =>
      item.data().orderId === orderId
    );

    if (alreadyRequested) {
      alert("इस ऑर्डर की Cancellation Request पहले से भेजी जा चुकी है।");
      return;
    }

    await addDoc(collection(db, "cancellationRequests"), {
      orderId: orderId,
      customerUid: user.uid,
      reason: cleanReason,
      status: "pending",
      createdAt: serverTimestamp()
    });

    alert("Cancellation Request Admin को भेज दी गई है।");
    await window.loadMyCustomerOrders();

  } catch (error) {
    alert("Request भेजने में समस्या: " + error.message);
  }
};

// Attach customer UID to orders placed by registered customers
window.saveCustomerOrder = async function(order) {
  await auth.authStateReady();

  const user = auth.currentUser;
  if (!user) {
    throw new Error("ऑर्डर करने के लिए Customer Login जरूरी है।");
  }

  const profile = await getDoc(doc(db, "users", user.uid));
  if (!profile.exists() || profile.data().role !== "customer") {
    throw new Error("सही Customer Account से Login करें।");
  }

  const data = {
    customerUid: user.uid,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    items: order.items,
    orderLines: order.orderLines || [],
    total: order.total,
    payment: order.payment,
    status: "new",
    createdAt: serverTimestamp()
  };

  return await addDoc(collection(db, "orders"), data);
};


// CUSTOMER PROFILE LOAD AND UPDATE
window.loadCustomerProfile = async function() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const profile = await getDoc(doc(db, "users", user.uid));
    if (!profile.exists() || profile.data().role !== "customer") return;

    const data = profile.data();
    document.getElementById("customerEditName").value = data.name || "";
    document.getElementById("customerEditPhone").value = data.phone || "";
    document.getElementById("customerEditAddress").value = data.address || "";
  } catch (error) {
    document.getElementById("customerAccountMessage").textContent =
      "Profile लोड नहीं हुई: " + error.message;
  }
};

window.updateCustomerProfile = async function() {
  const user = auth.currentUser;
  const msg = document.getElementById("customerAccountMessage");

  if (!user) {
    msg.textContent = "पहले Customer Login करें।";
    return;
  }

  const name = document.getElementById("customerEditName").value.trim();
  const phone = document.getElementById("customerEditPhone").value.trim();
  const address = document.getElementById("customerEditAddress").value.trim();

  if (!name || !/^[0-9]{10}$/.test(phone) || !address) {
    msg.textContent = "नाम, सही 10 अंकों का मोबाइल और पूरा पता भरें।";
    return;
  }

  try {
    const ref = doc(db, "users", user.uid);
    const profile = await getDoc(ref);

    if (!profile.exists() || profile.data().role !== "customer") {
      msg.textContent = "Customer Profile नहीं मिली।";
      return;
    }

    await updateDoc(ref, { name, phone, address });

    document.getElementById("customerWelcome").textContent =
      "स्वागत है, " + name;
    msg.textContent = "आपकी Profile सफलतापूर्वक अपडेट हो गई!";
  } catch (error) {
    msg.textContent = "Profile अपडेट नहीं हुई: " + error.message;
  }
};

// AUTO-FILL CUSTOMER CHECKOUT
window.fillCustomerCheckout = async function() {
  try {
    await auth.authStateReady();

    const user = auth.currentUser;
    if (!user) {
      console.log("Customer Login नहीं मिला।");
      return false;
    }

    const profile = await getDoc(doc(db, "users", user.uid));

    if (!profile.exists() || profile.data().role !== "customer") {
      console.log("Customer Profile नहीं मिली।");
      return false;
    }

    const data = profile.data();

    document.getElementById("customerName").value = data.name || "";
    document.getElementById("customerPhone").value = data.phone || "";
    document.getElementById("customerAddress").value = data.address || "";

    console.log("Customer Checkout Auto-Fill सफल।");
    return true;

  } catch (error) {
    console.error("Checkout Auto-Fill Error:", error);
    return false;
  }
};

// ADMIN: CUSTOMER CANCELLATION REQUESTS
window.loadCancellationRequests = async function() {
  const message = document.getElementById("cancellationAdminMessage");
  const container = document.getElementById("adminCancellationRequests");

  try {
    const user = auth.currentUser;
    if (!user) throw new Error("पहले Admin Login करें।");

    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    if (!adminSnap.exists()) throw new Error("Admin अनुमति नहीं मिली।");

    message.textContent = "Requests लोड हो रही हैं...";
    container.replaceChildren();

    const snapshot = await getDocs(collection(db, "cancellationRequests"));

    if (snapshot.empty) {
      message.textContent = "अभी कोई Cancellation Request नहीं है।";
      return;
    }

    for (const requestDoc of snapshot.docs) {
      const request = requestDoc.data();
      const orderSnap = await getDoc(doc(db, "orders", request.orderId));
      const order = orderSnap.exists() ? orderSnap.data() : {};

      const card = document.createElement("div");
      card.style.cssText = "border:1px solid #ccc;padding:12px;margin:10px 0;border-radius:8px";

      const details = document.createElement("p");
      details.textContent =
        "Order ID: " + request.orderId +
        " | ग्राहक: " + (order.customerName || "—") +
        " | फोन: " + (order.phone || "—") +
        " | कारण: " + request.reason +
        " | स्थिति: " + request.status;

      card.appendChild(details);

      if (request.status === "pending") {
        const approve = document.createElement("button");
        approve.textContent = "Approve Cancellation";
        approve.addEventListener("click", () => {
          window.approveCancellationRequest(requestDoc.id);
        });

        const reject = document.createElement("button");
        reject.textContent = "Reject Request";
        reject.style.marginLeft = "8px";
        reject.addEventListener("click", () => {
          window.rejectCancellationRequest(requestDoc.id);
        });

        card.append(approve, reject);
      }

      container.appendChild(card);
    }

    message.textContent = "कुल Requests: " + snapshot.size;

  } catch (error) {
    message.textContent = "Error: " + error.message;
  }
};

// ADMIN: APPROVE CANCELLATION
window.approveCancellationRequest = async function(requestId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("पहले Admin Login करें।");

    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    if (!adminSnap.exists()) throw new Error("Admin अनुमति नहीं मिली।");

    const requestRef = doc(db, "cancellationRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) throw new Error("Request नहीं मिली।");

    const request = requestSnap.data();
    if (request.status !== "pending") throw new Error("यह Request पहले ही Review हो चुकी है।");

    const orderRef = doc(db, "orders", request.orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) throw new Error("Order नहीं मिला।");

    const order = orderSnap.data();
    if (
      order.customerUid !== request.customerUid ||
      !["new", "confirmed", "packed", "out_for_delivery"].includes(order.status)
    ) {
      throw new Error("इस Order को अब Cancel नहीं किया जा सकता।");
    }

    const sellerSnapshot = await getDocs(query(
      collection(db, "sellerOrders"),
      where("orderId", "==", request.orderId)
    ));

    const batch = writeBatch(db);

    batch.update(orderRef, { status: "cancelled" });
    batch.update(requestRef, {
      status: "approved",
      reviewedAt: serverTimestamp()
    });

    sellerSnapshot.docs.forEach(sellerDoc => {
      batch.update(doc(db, "sellerOrders", sellerDoc.id), {
        status: "cancelled"
      });
    });

    await batch.commit();

    alert("Cancellation Request Approve हो गई।");
    await window.loadCancellationRequests();

  } catch (error) {
    alert("Approve नहीं हुआ: " + error.message);
  }
};

// ADMIN: REJECT CANCELLATION
window.rejectCancellationRequest = async function(requestId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("पहले Admin Login करें।");

    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    if (!adminSnap.exists()) throw new Error("Admin अनुमति नहीं मिली।");

    const requestRef = doc(db, "cancellationRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) throw new Error("Request नहीं मिली।");
    if (requestSnap.data().status !== "pending") {
      throw new Error("यह Request पहले ही Review हो चुकी है।");
    }

    await updateDoc(requestRef, {
      status: "rejected",
      reviewedAt: serverTimestamp()
    });

    alert("Cancellation Request Reject कर दी गई।");
    await window.loadCancellationRequests();

  } catch (error) {
    alert("Reject नहीं हुआ: " + error.message);
  }
};
