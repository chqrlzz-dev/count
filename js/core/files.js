/**
 * File Processing (PDF/DOCX)
 */

// Checks if two dimensions match (either orientation) within tolerance of 20pt
function isSizePt(w1, h1, w2, h2, tol = 20) {
  return (
    (Math.abs(w1 - w2) < tol && Math.abs(h1 - h2) < tol) ||
    (Math.abs(w1 - h2) < tol && Math.abs(h1 - w2) < tol)
  );
}

async function readPdfPageCountAsync(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("pdf.js not loaded");

  pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
    .promise;
  const numPages = pdf.numPages;

  if (!Number.isInteger(numPages) || numPages < 1 || numPages > 9999) {
    throw new Error(`Bad page count: ${numPages}`);
  }

  let detectedSize = "short";
  for (let i = 1; i <= Math.min(numPages, 3); i++) {
    try {
      const page = await pdf.getPage(i);
      if (i === 1) {
        const v = page.view;
        const width = Math.abs(v[2] - v[0]);
        const height = Math.abs(v[3] - v[1]);
        if (isSizePt(width, height, 612, 936)) detectedSize = "long";
        else if (isSizePt(width, height, 595, 842)) detectedSize = "a4";
        else if (isSizePt(width, height, 612, 792)) detectedSize = "short";
        else {
          const longest = Math.max(width, height);
          if (longest > 870) detectedSize = "long";
          else if (longest > 810) detectedSize = "a4";
          else detectedSize = "short";
        }
      }
    } catch (e) {
      console.warn(`Failed to parse page ${i}`, e);
    }
  }

  return { numPages, detectedSize };
}

async function readDocxPageCountAsync(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);
    
    const appXml = await loadedZip.file("docProps/app.xml")?.async("string");
    let metadataPages = 0;
    if (appXml) {
      const m = appXml.match(/<Pages>(\d+)<\/Pages>/);
      if (m) metadataPages = parseInt(m[1]);
    }

    const docXml = await loadedZip.file("word/document.xml")?.async("string");
    let breakCount = 1;
    if (docXml) {
      const explicit = (docXml.match(/<w:br\s+[^>]*w:type="page"/g) || [])
        .length;
      const rendered = (docXml.match(/<w:lastRenderedPageBreak/g) || []).length;
      breakCount = 1 + Math.max(explicit, rendered);
    }

    let contentPages = 0;
    if (window.mammoth) {
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || "";
      contentPages = Math.ceil(text.length / DOCX_BYTES_PER_PAGE);
    }

    const finalPages = Math.max(metadataPages, breakCount, contentPages, 1);
    if (metadataPages > 0 && contentPages > 0) {
      if (metadataPages > contentPages * 3)
        return Math.max(breakCount, contentPages);
    }
    return finalPages;
  } catch (e) {
    console.warn("DOCX reliable count failed", e);
    return estimateDocxPageCount(file);
  }
}

function estimateDocxPageCount(file) {
  return Math.max(1, Math.ceil(file.size / DOCX_BYTES_PER_PAGE));
}

async function processFilesAsync(files) {
  if (!files || files.length === 0) return;
  
  const fileArray = Array.from(files);
  const total = fileArray.length;
  
  // Process in parallel with a small delay between batches to keep UI responsive if needed
  // For now, simple Promise.all is fastest
  await Promise.all(fileArray.map(async (file) => {
    try {
      await processUploadedFileAsync(file);
    } catch (e) {
      console.error(`Failed to process ${file.name}`, e);
      showToast(`Failed to process ${file.name}`, "error");
    }
  }));
  
  setTimeout(() => {
    showToast(`Successfully processed ${total} files`, "success");
  }, 500);
}

async function processUploadedFileAsync(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const isPdf = ext === "pdf";
  const isDocx = ext === "docx" || ext === "doc";
  const itemId = state.nextItemId++;
  const fileName = stripExtension(file.name);
  const copies = parseInt(el("default-copies")?.value) || state.settings.defaultCopies;

  const colorMode = "bw";
  const paperSize = "short";
  const unitPrice = getPriceForItem(colorMode, paperSize);

  const item = {
    id: itemId,
    fileName,
    fileExt: ext,
    fileSize: file.size,
    pages: 0,
    copies,
    colorMode,
    paperSize,
    unitPrice,
    isPageExact: false,
    isManual: false,
    needsPageEntry: false,
  };

  state.fileItems.push(item);
  renderFileTableRow(item);
  showCompactDropZone();

  if (isPdf) {
    try {
      const result = await readPdfPageCountAsync(file);
      item.paperSize = result.detectedSize;
      item.unitPrice = getPriceForItem(item.colorMode, item.paperSize);
      mutateItemPages(item.id, result.numPages, true);
    } catch {
      mutateItemNeedsPageEntry(item.id);
    }
  } else if (isDocx) {
    try {
      const pages = await readDocxPageCountAsync(file);
      mutateItemPages(item.id, pages, true);
    } catch {
      const estimated = estimateDocxPageCount(file);
      mutateItemPages(item.id, estimated, false);
    }
  } else {
    mutateItemNeedsPageEntry(item.id);
  }
}

function mutateItemPages(id, pages, isExact) {
  const item = findItemById(id);
  if (!item) return;
  item.pages = pages;
  item.isPageExact = isExact;
  item.needsPageEntry = false;
  refreshItemRow(id);
  updateTotals();
  updateInvoicePreview();
}

function mutateItemNeedsPageEntry(id) {
  const item = findItemById(id);
  if (!item) return;
  item.needsPageEntry = true;
  refreshItemRow(id);
}

function findItemById(id) {
  return state.fileItems.find((i) => i.id === id);
}
