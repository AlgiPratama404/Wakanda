const onReady = () => {
  setupLoader();
  setupMobileMenu();
  setupActiveNav();
  setupScrollReveal();
  setupHashHighlight();
  setupFaq();
  setupGalleryFilter();
  setupGalleryModal();
  setupSlider();
  setupReservationPaymentFlow();
  setupForms();
  setupKontakForm();
};

function setupReservationPaymentFlow() {
  const receiptEmpty = document.querySelector("[data-receipt-empty]");
  const receiptContent = document.querySelector("[data-receipt-content]");

  const reservationForm = document.querySelector("[data-reservation-form]");
  const paymentForm = document.querySelector("[data-payment-form]");
  const printReceiptButton = document.querySelector("[data-print-receipt]");
  const resetReservationButtons = document.querySelectorAll(
    "[data-reset-reservation]",
  );

  if (reservationForm) {
    setupReservationSubmit(reservationForm);
  }

  if (paymentForm) {
    setupPaymentSubmit(paymentForm);
    setupPaymentSummary();
  }

  if (receiptContent || receiptEmpty) {
    renderReceipt({ receiptEmpty, receiptContent, printReceiptButton });
  }

  if (resetReservationButtons && resetReservationButtons.length) {
    resetReservationButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        try {
          localStorage.removeItem("wakandaReservation");
          localStorage.removeItem("wakandaReceipt");
        } catch (err) {
          // ignore
        }
      });
    });
  }
}

function setupReservationSubmit(formEl) {
  formEl.addEventListener("submit", (event) => {
    event.preventDefault();

    const fields = formEl.querySelectorAll("[data-required]");
    let isValid = true;

    fields.forEach((field) => {
      const value =
        field.type === "checkbox"
          ? field.checked
            ? "1"
            : ""
          : field.value.trim();
      const errorNode = formEl.querySelector(
        `[data-error-for="${field.name}"]`,
      );
      let message = "";

      if (!value) {
        message = "Kolom ini wajib diisi.";
      } else if (
        field.type === "email" &&
        !/\S+@\S+\.\S+/.test(field.value.trim())
      ) {
        message = "Masukkan alamat email yang valid.";
      }

      if (errorNode) {
        errorNode.textContent = message;
      }

      if (message) {
        isValid = false;
      }
    });

    if (!isValid) return;

    const reservation = readFormValues(formEl);

    try {
      localStorage.setItem("wakandaReservation", JSON.stringify(reservation));
    } catch (err) {
      // ignore
    }

    // multi-page: pindah ke halaman pembayaran
    window.location.href = "pembayaran.html";
  });
}

function setupPaymentSubmit(formEl) {
  formEl.addEventListener("submit", (event) => {
    event.preventDefault();

    const requiredFields = formEl.querySelectorAll("[data-required]");
    let isValid = true;

    requiredFields.forEach((field) => {
      const errorNode = formEl.querySelector(
        `[data-error-for="${field.name}"]`,
      );
      let message = "";

      if (field.type === "checkbox") {
        if (!field.checked) message = "Kolom ini wajib diisi.";
      } else if (field.type === "radio") {
        const checked = formEl.querySelector(
          `input[name="${field.name}"]:checked`,
        );
        if (!checked) message = "Pilih metode pembayaran.";
      } else {
        const value = field.value.trim();
        if (!value) message = "Kolom ini wajib diisi.";
        if (!message && field.type === "email" && !/\S+@\S+\.\S+/.test(value)) {
          message = "Masukkan alamat email yang valid.";
        }
      }

      if (errorNode) {
        errorNode.textContent = message;
      }

      if (message) isValid = false;
    });

    if (!isValid) return;

    const payment = readFormValues(formEl);

    // Normalisasi data dari pembayaran.html agar renderReceipt konsisten.
    // HTML pembayaran.html memiliki input:
    //  - paymentMethod (radio)
    //  - paymentName (text)
    //  - paymentContact (email)  -> kita gunakan sebagai paymentReference/demo
    //  - paymentSource (text)
    // Di renderReceipt, yang ditampilkan:
    //  - paymentMethod
    //  - paymentSource
    //  - paymentReference
    //  - (paymentCode sudah dibuat otomatis)

    // Pastikan paymentMethod tersimpan (radio sudah mengisi value)
    if (!payment.paymentMethod) payment.paymentMethod = null;

    // Simpan untuk hitung admin fee (computePricing baca wakandaLastPaymentMethod)
    // Agar total mengikuti metode yang dipilih user.
    try {
      if (payment.paymentMethod) {
        localStorage.setItem(
          "wakandaLastPaymentMethod",
          JSON.stringify(payment.paymentMethod),
        );
      }
    } catch (err) {
      // ignore
    }

    // Map email pengiriman bukti menjadi reference demo
    if (!payment.paymentReference && payment.paymentContact) {
      payment.paymentReference = payment.paymentContact;
    }

    // Pastikan paymentSource ada
    if (!payment.paymentSource && payment.paymentSource !== "") {
      // (noop) - paymentSource memang name yang sama di form
    }

    const reservationRaw = safeParse(
      localStorage.getItem("wakandaReservation"),
    );
    if (!reservationRaw) {
      window.location.href = "reservasi.html";
      return;
    }

    const pricing = computePricing(reservationRaw);

    const bookingCode = generateCode("WKD");
    const paymentCode = generateCode("TRX");
    const paidAt = new Date();

    const receipt = {
      bookingCode,
      paymentCode,
      paidAt: paidAt.toISOString(),
      reservation: reservationRaw,
      payment,
      pricing,
    };

    try {
      localStorage.setItem("wakandaReceipt", JSON.stringify(receipt));
    } catch (err) {
      // ignore
    }

    window.location.href = "bukti-pembayaran.html";
  });
}

function setupPaymentSummary() {
  const reservation = safeParse(localStorage.getItem("wakandaReservation"));
  const emptySection = document.querySelector("[data-payment-empty]");
  const contentSection = document.querySelector("[data-payment-content]");

  if (!reservation) {
    if (emptySection) emptySection.hidden = false;
    if (contentSection) contentSection.hidden = true;
    return;
  }

  if (emptySection) emptySection.hidden = true;
  if (contentSection) contentSection.hidden = false;

  const pricing = computePricing(reservation);

  const summary = {
    bookingCode: "-", // belum final saat pembayaran belum submit
    name: reservation.nama || "-",
    package: reservation.paket || "-",
    date: reservation.tanggal || "-",
    session: reservation.sesi || "-",
    visitors: reservation.jumlah || "-",
    subtotal: pricing.subtotal,
    service: pricing.service,
    conservation: pricing.conservation,
    admin: pricing.admin,
    total: pricing.total,
    note: reservation.catatan
      ? reservation.catatan.trim()
      : "Tidak ada catatan tambahan.",
  };

  setText("[data-summary-name]", summary.name);
  setText("[data-summary-package]", summary.package);
  setText("[data-summary-date]", summary.date);
  setText("[data-summary-session]", summary.session);
  setText("[data-summary-visitors]", String(summary.visitors));
  setText("[data-summary-subtotal]", formatIDR(summary.subtotal));
  setText("[data-summary-service]", formatIDR(summary.service));
  setText("[data-summary-conservation]", formatIDR(summary.conservation));
  setText("[data-summary-admin]", formatIDR(summary.admin));
  setText("[data-summary-total]", formatIDR(summary.total));
  setText("[data-summary-note]", summary.note);
}

function renderReceipt({ receiptEmpty, receiptContent, printReceiptButton }) {
  const receipt = safeParse(localStorage.getItem("wakandaReceipt"));

  if (!receipt) {
    if (receiptEmpty) receiptEmpty.hidden = false;
    if (receiptContent) receiptContent.hidden = true;
    return;
  }

  if (receiptEmpty) receiptEmpty.hidden = true;
  if (receiptContent) receiptContent.hidden = false;

  const r = receipt.reservation || {};
  const p = receipt.payment || {};
  const pricing = receipt.pricing || {};

  setText("[data-receipt-booking-code]", receipt.bookingCode || "-");
  setText(
    "[data-receipt-paid-at]",
    receipt.paidAt ? formatDateTimeID(receipt.paidAt) : "-",
  );

  setText("[data-receipt-name]", r.nama || "-");
  setText("[data-receipt-email]", r.email || "-");
  setText("[data-receipt-phone]", r.telepon || "-");
  setText("[data-receipt-city]", r.asalKota || "-");

  setText("[data-receipt-package]", r.paket || "-");
  setText("[data-receipt-date]", r.tanggal || "-");
  setText("[data-receipt-session]", r.sesi || "-");
  setText("[data-receipt-visitors]", r.jumlah || "-");

  setText("[data-receipt-payment-code]", receipt.paymentCode || "-");
  setText("[data-receipt-method]", paymentMethodLabel(p.paymentMethod));
  setText("[data-receipt-source]", p.paymentSource || "-");
  setText("[data-receipt-reference]", p.paymentReference || "-");

  setText("[data-receipt-subtotal]", formatIDR(pricing.subtotal));
  setText("[data-receipt-service]", formatIDR(pricing.service));
  setText("[data-receipt-conservation]", formatIDR(pricing.conservation));
  setText("[data-receipt-admin]", formatIDR(pricing.admin));
  setText("[data-receipt-total]", formatIDR(pricing.total));

  const note = r.catatan ? r.catatan.trim() : "Tidak ada catatan tambahan.";
  setText("[data-receipt-note]", note);

  if (printReceiptButton) {
    printReceiptButton.addEventListener("click", () => {
      window.print();
    });
  }
}

function readFormValues(formEl) {
  const data = {};

  const inputs = formEl.querySelectorAll("input, select, textarea");
  inputs.forEach((el) => {
    const name = el.name;
    if (!name) return;

    if (el.type === "checkbox") {
      data[name] = Boolean(el.checked);
      return;
    }

    if (el.type === "radio") {
      if (el.checked) data[name] = el.value;
      return;
    }

    data[name] = el.value;
  });

  // normalize checkbox required to true/false string not needed; but keep boolean for setuju
  return data;
}

function computePricing(reservation) {
  // Demo pricing (deterministic) untuk tampilan profesional.
  const visitors = Math.max(1, Number(reservation.jumlah || 1));
  // Normalisasi paket agar konsisten dengan value form
  // (contoh: di reservasi.html ada value "Ticket" untuk item "Baju Adat" sehingga perlu mapping khusus)
  const paketRaw = reservation.paket || "Ticket";
  const paket = paketRaw;

  const baseByPaket = {
    Ticket: 5000,
    "Rakit Bambu": 25000,
    Trekking: 30000,
    "Offroad Adventure": 150000,
    "Camping Ground": 20000,
    "Baju Adat": 150000,
  };

  const base = baseByPaket[paket] ?? 25000;
  const subtotal = base * visitors;

  const service = Math.round(subtotal * 0.06);
  const conservation = Math.round(subtotal * 0.04);

  // Metode bayar demo: tarif admin kecil
  const paymentMethod =
    safeParse(localStorage.getItem("wakandaLastPaymentMethod")) || null;
  const admin = (() => {
    if (!paymentMethod) return Math.round(subtotal * 0.03);
    if (paymentMethod === "ewallet") return Math.round(subtotal * 0.025);
    if (paymentMethod === "qris") return Math.round(subtotal * 0.02);
    return Math.round(subtotal * 0.03);
  })();

  const total = subtotal + service + conservation + admin;

  return { base, subtotal, service, conservation, admin, total };
}

function paymentMethodLabel(value) {
  const map = {
    bca: "Transfer BCA",
    mandiri: "Virtual Account",
    ewallet: "DANA / GoPay",
    qris: "QRIS Wisata",
  };
  return map[value] || value || "-";
}

function generateCode(prefix) {
  const now = Date.now();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${String(now).slice(-6)}${rand}`.slice(
    0,
    prefix.length + 1 + 12,
  );
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

function setText(selector, text) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = text;
}

function formatIDR(amount) {
  const num = Number(amount || 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDateTimeID(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function setupLoader() {
  const loader = document.querySelector("[data-loader]");

  if (!loader) {
    return;
  }

  document.body.classList.add("is-loading");

  window.addEventListener("load", () => {
    loader.classList.add("is-hidden");
    document.body.classList.remove("is-loading");
  });
}

function setupMobileMenu() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");

  // helper untuk animasi navbar desktop
  setupNavbarAnimation();

  if (!toggle || !menu) {
    return;
  }

  const closeMenu = () => {
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("is-open");
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    menu.classList.toggle("is-open", isOpen);
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1120) {
      closeMenu();
    }
  });
}

function setupActiveNav() {
  const current = window.location.pathname.split("/").pop() || "index.html";
  const links = document.querySelectorAll("[data-nav-link]");

  links.forEach((link) => {
    const target = link.getAttribute("href");
    const normalized = target === "./" ? "index.html" : target;
    const isInformationGroup =
      current.startsWith("informasi") && normalized.startsWith("informasi");

    if (normalized === current || isInformationGroup) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
  });
}

function setupScrollReveal() {
  const elements = Array.from(document.querySelectorAll(".reveal"));

  if (!elements.length) {
    return;
  }

  // Stagger: delay naik per urutan elemen di DOM
  const baseDelayMs = 80;
  elements.forEach((el, idx) => {
    const delay = Number(el.dataset.revealDelay || idx * baseDelayMs);
    el.style.transitionDelay = `${delay}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -40px 0px",
    },
  );

  elements.forEach((element) => observer.observe(element));
}

function setupHashHighlight() {
  const highlightDurationMs = 950;

  const run = () => {
    const hash = (window.location.hash || "").replace("#", "");
    if (!hash) return;

    const target =
      document.getElementById(hash) ||
      document.querySelector(`[name="${hash}"]`);

    if (!target) return;

    // aksesibilitas scroll offset: class bisa ditambah ke CSS jika butuh
    target.classList.add("is-hash-target");

    window.setTimeout(() => {
      target.classList.remove("is-hash-target");
    }, highlightDurationMs);
  };

  // jalankan saat load
  run();

  // jalankan saat hash berubah
  window.addEventListener("hashchange", () => {
    // beri waktu browser selesai scroll smooth
    window.setTimeout(run, 250);
  });
}

function setupFaq() {
  const items = document.querySelectorAll("[data-faq-item]");

  items.forEach((item) => {
    const button = item.querySelector("[data-faq-trigger]");
    const content = item.querySelector("[data-faq-content]");

    if (!button || !content) {
      return;
    }

    button.addEventListener("click", () => {
      const isOpen = item.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
      content.style.maxHeight = isOpen ? `${content.scrollHeight}px` : "0px";
    });
  });
}

function setupGalleryFilter() {
  const buttons = document.querySelectorAll("[data-filter-button]");
  const items = document.querySelectorAll("[data-gallery-category]");

  if (!buttons.length || !items.length) {
    return;
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filterButton;

      buttons.forEach((other) => other.classList.remove("is-active"));
      button.classList.add("is-active");

      items.forEach((item) => {
        const category = item.dataset.galleryCategory;
        const show = filter === "all" || category.includes(filter);
        item.classList.toggle("is-hidden", !show);
      });
    });
  });
}

function setupGalleryModal() {
  const modal = document.querySelector("[data-gallery-modal]");
  const modalImage = document.querySelector("[data-gallery-modal-image]");
  const modalClose = document.querySelector("[data-gallery-modal-close]");
  const triggers = document.querySelectorAll("[data-gallery-trigger]");

  if (!modal || !modalImage || !modalClose || !triggers.length) {
    return;
  }

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-modal-open");
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const image = trigger.querySelector("img");

      if (!image) {
        return;
      }

      modalImage.src = image.src;
      modalImage.alt = image.alt;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-modal-open");
    });
  });

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

function setupSlider() {
  const sliders = document.querySelectorAll("[data-slider]");

  sliders.forEach((slider) => {
    const track = slider.querySelector("[data-slider-track]");
    const slides = slider.querySelectorAll("[data-slide]");
    const prev = slider.querySelector("[data-slider-prev]");
    const next = slider.querySelector("[data-slider-next]");
    const dots = slider.querySelectorAll("[data-slider-dot]");
    let index = 0;

    if (!track || slides.length < 2) {
      return;
    }

    const render = () => {
      track.style.transform = `translateX(-${index * 100}%)`;

      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("is-active", dotIndex === index);
      });
    };

    prev?.addEventListener("click", () => {
      index = index === 0 ? slides.length - 1 : index - 1;
      render();
    });

    next?.addEventListener("click", () => {
      index = index === slides.length - 1 ? 0 : index + 1;
      render();
    });

    dots.forEach((dot, dotIndex) => {
      dot.addEventListener("click", () => {
        index = dotIndex;
        render();
      });
    });

    setInterval(() => {
      index = index === slides.length - 1 ? 0 : index + 1;
      render();
    }, 4500);

    render();
  });
}

function setupForms() {
  const forms = document.querySelectorAll("[data-validate]");

  forms.forEach((form) => {
    // Skip form kontak (kami handle khusus karena ada preview upload)
    if (form.querySelector("[data-contact-submit]")) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const fields = form.querySelectorAll("[data-required]");
      let isValid = true;

      fields.forEach((field) => {
        const errorNode = form.querySelector(
          `[data-error-for="${field.name}"]`,
        );

        let message = "";

        if (field.type === "checkbox") {
          if (!field.checked) message = "Kolom ini wajib diisi.";
        } else {
          const value = (field.value || "").trim();
          if (!value) message = "Kolom ini wajib diisi.";
          else if (field.type === "email" && !/\S+@\S+\.\S+/.test(value)) {
            message = "Masukkan alamat email yang valid.";
          }
        }

        if (errorNode) {
          errorNode.textContent = message;
        }

        if (message) isValid = false;
      });

      if (!isValid) return;

      const status = form.querySelector("[data-form-status]");
      if (status) {
        status.textContent =
          "Form berhasil divalidasi. Pada versi statis ini data belum dikirim ke server.";
      }

      form.reset();
    });
  });
}

function setupKontakForm() {
  const form = document.querySelector(
    "form[data-validate] [data-contact-submit]",
  )
    ? document
        .querySelector("form[data-validate] [data-contact-submit]")
        .closest("form")
    : null;

  if (!form) return;

  const submitBtn = form.querySelector("[data-contact-submit]");
  const statusEl = form.querySelector("[data-form-status]");

  const fotoInput = form.querySelector("#kontak-foto");
  const previewEl = form.querySelector("[data-photo-preview]");

  const MAX_FILES = 5;
  const MAX_EACH_MB = 4; // demo guard
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "image/gif",
  ];

  let uploadedPhotos = []; // {name, dataUrl}

  const setStatus = (msg) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
  };

  const setBtnLoading = (isLoading) => {
    if (!submitBtn) return;
    submitBtn.classList.toggle("is-loading", isLoading);
    submitBtn.disabled = isLoading;
  };

  const setBtnSuccess = () => {
    if (!submitBtn) return;
    submitBtn.classList.add("is-success");
    setTimeout(() => {
      submitBtn.classList.remove("is-success");
    }, 2500);
  };

  const clearPreview = () => {
    if (previewEl) previewEl.innerHTML = "";
    uploadedPhotos = [];
  };

  const renderPreview = () => {
    if (!previewEl) return;

    previewEl.innerHTML = "";

    if (!uploadedPhotos.length) {
      const empty = document.createElement("p");
      empty.className = "helper-text";
      empty.style.margin = "0";
      empty.textContent = "Belum ada foto yang dipilih.";
      previewEl.appendChild(empty);
      return;
    }

    uploadedPhotos.forEach((p, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "contact-upload__thumb";

      const img = document.createElement("img");
      img.src = p.dataUrl;
      img.alt = `Foto aspirasi ${idx + 1}`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "Hapus foto");
      btn.textContent = "×";
      btn.addEventListener("click", () => {
        uploadedPhotos.splice(idx, 1);
        renderPreview();
      });

      wrap.appendChild(img);
      wrap.appendChild(btn);
      previewEl.appendChild(wrap);
    });
  };

  // Dropzone (pakai wrapper .contact-upload)
  const dropzone = form.querySelector(".contact-upload");
  if (dropzone) {
    ["dragenter", "dragover"].forEach((evtName) => {
      dropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((evtName) => {
      dropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) handleFiles(files);
    });
  }

  const readFilesAsDataUrls = async (files) => {
    const results = [];

    for (const file of files) {
      // guard size/type
      const mb = file.size / (1024 * 1024);
      const typeOk =
        ALLOWED_TYPES.includes(file.type) || file.type.startsWith("image/");
      if (!typeOk) throw new Error("Format foto tidak didukung.");
      if (mb > MAX_EACH_MB)
        throw new Error(
          `Ukuran foto terlalu besar (maks ${MAX_EACH_MB}MB per foto).`,
        );

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Gagal membaca file."));
        reader.readAsDataURL(file);
      });

      results.push({ name: file.name, dataUrl });
    }

    return results;
  };

  const handleFiles = async (files) => {
    clearPreview();
    setStatus("");

    const images = files.filter((f) => (f.type || "").startsWith("image/"));
    if (!images.length) {
      renderPreview();
      return;
    }

    const sliced = images.slice(0, MAX_FILES);
    if (images.length > MAX_FILES) {
      setStatus(
        `Maksimal ${MAX_FILES} foto. Foto yang diproses hanya ${MAX_FILES} pertama.`,
      );
    }

    const data = await readFilesAsDataUrls(sliced);
    uploadedPhotos = data;
    renderPreview();
  };

  if (fotoInput) {
    fotoInput.addEventListener("change", async () => {
      try {
        const files = Array.from(fotoInput.files || []);
        if (files.length === 0) {
          clearPreview();
          renderPreview();
          return;
        }
        await handleFiles(files);
      } catch (err) {
        clearPreview();
        renderPreview();
        setStatus(String(err?.message || err));
      }
    });
  }

  // init preview
  renderPreview();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // clear error fields
    const required = form.querySelectorAll("[data-required]");
    required.forEach((field) => {
      const errorNode = form.querySelector(`[data-error-for="${field.name}"]`);
      if (errorNode) errorNode.textContent = "";
    });

    // validate
    let isValid = true;

    required.forEach((field) => {
      const errorNode = form.querySelector(`[data-error-for="${field.name}"]`);
      let message = "";
      const value = (field.value || "").trim();

      if (!value && field.tagName.toLowerCase() !== "select") {
        message = "Kolom ini wajib diisi.";
      }

      if (field.type === "email") {
        if (value && !/\S+@\S+\.\S+/.test(value)) {
          message = "Masukkan alamat email yang valid.";
        } else if (!value) {
          message = "Kolom ini wajib diisi.";
        }
      }

      if (field.tagName.toLowerCase() === "select") {
        if (!value) message = "Kolom ini wajib diisi.";
      }

      if (
        !value &&
        field.tagName.toLowerCase() === "input" &&
        field.type !== "email"
      ) {
        message = "Kolom ini wajib diisi.";
      }

      if (message) isValid = false;
      if (errorNode) errorNode.textContent = message;
    });

    if (!isValid) return;

    // optional photos (validate count only)
    if (uploadedPhotos.length > MAX_FILES) {
      setStatus(`Maksimal ${MAX_FILES} foto.`);
      return;
    }

    setStatus("");
    setBtnLoading(true);

    // micro delay to show loading
    await new Promise((r) => setTimeout(r, 650));

    const data = readFormValues(form);

    const payload = {
      ...data,
      kontak_foto_preview: uploadedPhotos.map((p) => p.dataUrl),
      kontak_foto_count: uploadedPhotos.length,
      submittedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("wakandaKontak", JSON.stringify(payload));
    } catch (err) {
      // ignore storage issues
    }

    setBtnLoading(false);
    setBtnSuccess();
    setStatus("Terkirim! Aspirasi Anda sudah disimpan untuk demo sidang.");

    // Keep data (no reset) so user can see preview.
  });
}

document.addEventListener("DOMContentLoaded", onReady);

function setupNavbarAnimation() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;

    window.requestAnimationFrame(() => {
      const y = window.scrollY || 0;
      const shouldCompact = y > 40;

      header.style.background = shouldCompact
        ? "rgba(6, 78, 59, 0.9)"
        : "rgba(6, 78, 59, 0.97)";
      header.style.transform = shouldCompact
        ? "translateY(-2px)"
        : "translateY(0px)";

      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

document.addEventListener("DOMContentLoaded", onReady);
