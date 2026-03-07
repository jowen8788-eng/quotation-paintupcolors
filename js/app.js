document.addEventListener('DOMContentLoaded', function () {

  const VALID_USERS = [
    {username: 'admin',  hash: 'bfc6294928448987d1a40b668da79ac020db48aee3c1181c71d52b61e954faaa'},
    {username: 'miguel',  hash: '8cf536441b280bd3a7e343abfd03f55c24f552b4976f3766816a3c151f05dbeb'},
    {username: 'ulises', hash: '3280a9d8ce2ce2ed9fe91ae61df7ca885c72963639dc922adb3178a847c5a2a8'}
  ];

  // SHA-256 using the built-in Web Crypto API (no libraries needed)
  async function sha256(message) {
    const msgBuffer  = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ─────────────────────────────────────────
  // LOGIN LOGIC
  // ─────────────────────────────────────────
  const loginContainer = document.getElementById('loginContainer');
  const quotationContainer = document.getElementById('quotationContainer');
  const loginError = document.getElementById('loginError');

  // Check if already logged in (session persists while tab is open)
  if (sessionStorage.getItem('loggedIn') === 'true') {
    showQuotation();
  }

  document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const user     = document.getElementById('loginUser').value.trim();
    const pass     = document.getElementById('loginPass').value;
    const passHash = await sha256(pass);

    const match = VALID_USERS.find(u => u.username === user && u.hash === passHash);

    if (match) {
      sessionStorage.setItem('loggedIn', 'true');
      loginError.classList.remove('show');
      showQuotation();
    } else {
      loginError.classList.add('show');
      document.getElementById('loginPass').classList.add('error');
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
    }
  });

  // Clear error styling on input
  document.getElementById('loginPass').addEventListener('input', function() {
    this.classList.remove('error');
    loginError.classList.remove('show');
  });

  function showQuotation() {
    loginContainer.style.display = 'none';
    quotationContainer.style.display = 'block';
    // Update max-width for the larger form
    document.querySelector('.container').style.maxWidth = '800px';
  }

  function logout() {
    sessionStorage.removeItem('loggedIn');
    quotationContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
  }

  // ─────────────────────────────────────────
  // QUOTATION LOGIC (unchanged)
  // ─────────────────────────────────────────
  const form = document.getElementById('quotationForm');
  const successMessage = document.getElementById('successMessage');
  const DEFAULT_LOGO = './LogoPaintColor_v2.png';

  const inputs = form.querySelectorAll('input, textarea');
  inputs.forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.classList.contains('error')) validateField(input);
    });
  });
  // Evento Enter
  document.getElementById('description').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      document.getElementById('description').addEventListener('keydown');// Evita el comportamiento por defecto (salto de línea o envío)

    }
  });

  function validateField(field) {
    const errorElement = document.getElementById(`error${field.id.charAt(0).toUpperCase() + field.id.slice(1)}`);
    if (!field.value.trim()) {
      field.classList.add('error');
      if (errorElement) errorElement.classList.add('show');
      return false;
    }
    if (field.id === 'amount' && parseFloat(field.value) <= 0) {
      field.classList.add('error');
      if (errorElement) errorElement.classList.add('show');
      return false;
    }
    field.classList.remove('error');
    if (errorElement) errorElement.classList.remove('show');
    return true;
  }

  function validateForm() {
    let isValid = true;
    inputs.forEach(input => {if (!validateField(input)) isValid = false;});
    return isValid;
  }

  function clearForm() {
    form.reset();
    inputs.forEach(input => {
      input.classList.remove('error');
      const errorElement = document.getElementById(`error${input.id.charAt(0).toUpperCase() + input.id.slice(1)}`);
      if (errorElement) errorElement.classList.remove('show');
    });
    successMessage.classList.remove('show');
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!validateForm()) return;
    generatePDF();
  });

  function generatePDF() {
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF();

    // ── Data ──────────────────────────────────────────────────────────────
    const contractorName    = document.getElementById('contractorName').value.trim();
    const clientName        = document.getElementById('clientName').value.trim();
    const address           = document.getElementById('address').value.trim();
    const contractorAddress = document.getElementById('contractorAddress').value.trim();
    const description       = document.getElementById('description').value;
    const description2      = document.getElementById('description2').value;
    const amount            = parseFloat(document.getElementById('amount').value);
    const formattedAmount   = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(amount);
    const date              = new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'});

    // ── Constants ─────────────────────────────────────────────────────────
    const primaryColor  = [102, 126, 234];
    const textColor     = [50, 50, 50];
    const black         = [0, 0, 0];
    const PAGE_H        = 297;   // mm - A4 height
    const MARGIN_TOP    = 15;    // mm - top margin for continuation pages
    const MARGIN_BOTTOM = 25;    // mm - safe zone before footer area
    const CONTENT_LIMIT = PAGE_H - MARGIN_BOTTOM; // yPos limit before new page
    const LH            = 6;     // standard line height mm
    const MARGIN_L      = 20;
    const CONTENT_W     = 170;

    // ── Helper: check page overflow and add new page if needed ────────────
    // Returns updated yPos (resets to MARGIN_TOP on new page)
    function checkPage(y, neededSpace) {
      if (y + (neededSpace || LH) > CONTENT_LIMIT) {
        doc.addPage();
        drawPageHeader();          // repeat logo + thin top line on new pages
        return 48;   // espacio tras el header de continuación (logo 30mm + línea + margen)
      }
      return y;
    }

    // ── Helper: draw a lightweight header on continuation pages ───────────
    function drawPageHeader() {
      try {doc.addImage(DEFAULT_LOGO, 'PNG', 10, 5, 35, 30);}
      catch(e) {}
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.2);
      doc.line(MARGIN_L, 38, 190, 38);
    }

    // ── Helper: write paragraphs respecting \n + auto page-break ──────────
    // prefixFirstLine: string prepended only to the first non-empty paragraph
    function writeParagraphs(text, startY, prefixFirstLine) {
      let y = startY;
      const paragraphs = text.split('\n');
      let isFirst = true;
      paragraphs.forEach(para => {
        if (para.trim() === '') {
          y = checkPage(y, LH * 0.6);
          y += LH * 0.6;
        } else {
          const lineText   = (isFirst && prefixFirstLine) ? prefixFirstLine + para : para;
          const wrapped    = doc.splitTextToSize(lineText, CONTENT_W);
          y = checkPage(y, wrapped.length * LH);
          doc.text(wrapped, MARGIN_L, y);
          y += wrapped.length * LH;
          isFirst = false;
        }
      });
      return y;
    }

    // ── Helper: draw the signatures + footer on whatever the last page is ─
    function drawSignaturesAndFooter(y) {
      // We need ~55 mm for signatures + note + footer
      const NEEDED = 55;
      if (y + NEEDED > CONTENT_LIMIT) {
        doc.addPage();
        drawPageHeader();
        y = 48;
      } else {
        y += 10;
      }

      // Important note
      doc.setTextColor(...black);
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      const noteLines = doc.splitTextToSize(
        'Important note: If you agree with the quote provided, we require a 50% deposit to proceed and follow up on your service.',
        CONTENT_W
      );
      doc.text(noteLines, MARGIN_L, y);
      y += noteLines.length * LH + 14;

      // Signatures
      doc.setTextColor(...textColor);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.line(30, y, 90, y);
      doc.text('Contractor Signature', 60, y + 6, {align: 'center'});
      doc.setFont(undefined, 'bold');
      doc.text('Ulises Pineda', 60, y + 12, {align: 'center'});

      doc.setFont(undefined, 'normal');
      doc.line(120, y, 180, y);
      doc.text('Client Signature', 150, y + 6, {align: 'center'});
      doc.setFont(undefined, 'bold');
      doc.text(clientName, 150, y + 12, {align: 'center'});

      // Footer
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.setFont(undefined, 'italic');
      doc.text('This document is a valid quote for 30 days from the date of issue.', 105, PAGE_H - 8, {align: 'center'});
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PAGE 1 – HEADER BLOCK
    // ═══════════════════════════════════════════════════════════════════════
    try {doc.addImage(DEFAULT_LOGO, 'PNG', 10, 5, 35, 30);}
    catch (e) {console.error('Error adding logo:', e);}

    doc.setTextColor(...black);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('INVOICE', 105, 20, {align: 'center'});

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(date, 190, 30, {align: 'right'});

    // Contractor block (left column)
    let yLeft = 45;
    doc.setTextColor(...black);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('CONTRACTOR NAME:', MARGIN_L, yLeft);
    yLeft += LH;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...textColor);
    doc.text(contractorName, MARGIN_L, yLeft);
    yLeft += LH;
    const contractorAddrLines = doc.splitTextToSize(contractorAddress, 80);
    doc.text(contractorAddrLines, MARGIN_L, yLeft);
    yLeft += contractorAddrLines.length * LH;

    // Client block (right column)
    let yRight = 45;
    doc.setTextColor(...black);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('CLIENT NAME:', 105, yRight);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...textColor);
    const clientNameLines = doc.splitTextToSize(clientName, 80);
    doc.text(clientNameLines, 148, yRight);
    yRight += Math.max(clientNameLines.length, 1) * LH;

    doc.setTextColor(...black);
    doc.setFont(undefined, 'bold');
    doc.text('CLIENT ADDRESS:', 105, yRight);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...textColor);
    const addressLines = doc.splitTextToSize(address, 70);
    doc.text(addressLines, 142, yRight);
    yRight += addressLines.length * LH;

    // Divider below the taller of the two columns
    let yPos = Math.max(yLeft, yRight) + 6;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_L, yPos, 190, yPos);
    yPos += 10;

    // ── SERVICE DESCRIPTION ───────────────────────────────────────────────
    doc.setTextColor(...black);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('SERVICE DESCRIPTION:', MARGIN_L, yPos);
    yPos += 8;

    doc.setFont(undefined, 'normal');
    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    yPos = writeParagraphs(description, yPos, 'Paint Up Colors LLC – ');
    yPos += 6;

    // ── ESTIMATE DESCRIPTION ──────────────────────────────────────────────
    yPos = checkPage(yPos, LH * 2);
    doc.setTextColor(...black);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('DETAILS:', MARGIN_L, yPos);
    yPos += 8;

    doc.setFont(undefined, 'normal');
    doc.setTextColor(...textColor);
    doc.setFontSize(11);
    const prefix = 'For this project Paint Up Colors would charge ' + formattedAmount + ' – ';
    yPos = writeParagraphs(description2, yPos, prefix);
    yPos += 4;

    // Extra-work note
    yPos = checkPage(yPos, LH * 3);
    doc.setFontSize(11);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(100, 100, 100);
    const extraLines = doc.splitTextToSize(
      'Any extra work that needs to be done will be notified to the owner in advance. This will have an additional charge in material and time.',
      CONTENT_W
    );
    doc.text(extraLines, MARGIN_L, yPos);
    yPos += extraLines.length * LH + 8;

    // ── TOTAL BOX ─────────────────────────────────────────────────────────
    yPos = checkPage(yPos, 22);
    doc.setFillColor(240, 240, 255);
    doc.rect(MARGIN_L, yPos - 5, CONTENT_W, 18, 'F');
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.4);
    doc.rect(MARGIN_L, yPos - 5, CONTENT_W, 18, 'S');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...primaryColor);
    doc.text('Total:', MARGIN_L + 5, yPos + 7);
    doc.text(formattedAmount, 185, yPos + 7, {align: 'right'});
    yPos += 18;

    // ── SIGNATURES + FOOTER ───────────────────────────────────────────────
    drawSignaturesAndFooter(yPos);

    // ── SAVE ──────────────────────────────────────────────────────────────
    const fileName = `Quote_${clientName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    doc.save(fileName);

    successMessage.classList.add('show');
    setTimeout(() => successMessage.classList.remove('show'), 3000);
  }

  // Expose functions used by onclick attributes in HTML
  window.logout    = logout;
  window.clearForm = clearForm;

}); // end DOMContentLoaded
