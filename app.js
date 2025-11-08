// Lưu ý: import từ CDN ESM của jsDelivr (cách phổ biến cho package ESM trên browser)
import {
  convertOldToNew,
  convertNewToOld,
  find
} from "https://cdn.jsdelivr.net/npm/vietnam-address-converter/+esm";

// Helpers
const $ = (s) => document.querySelector(s);
const parseTable = (text) => {
  const trimmed = text.trim();
  if (!trimmed) return { header: [], rows: [] };

  // Ưu tiên TSV; nếu không có tab, thử CSV
  const delim = trimmed.includes("\t") ? "\t" : ",";
  const lines = trimmed.split(/\r?\n/).filter(l => l.trim().length);
  const cells = lines.map(l => l.split(delim).map(c => c.trim()));

  // phát hiện header
  const HEAD = new Set([
    "old_ward_code","old_ward_name","old_district_name","old_province_name",
    "new_ward_code","new_ward_name","new_province_name",
    "ward_code","ward_name","district_name","province_name"
  ]);
  const hasHeader = cells.length && cells[0].some(h => HEAD.has(h.toLowerCase()));
  const header = hasHeader ? cells[0] : [];
  const rows = hasHeader ? cells.slice(1) : cells;
  return { header, rows };
};

const joinTSV = (rows) => rows.map(r => r.join("\t")).join("\n");

function getCol(cols, header, name) {
  const idx = header.findIndex(h => h.toLowerCase() === name.toLowerCase());
  return idx >= 0 ? (cols[idx] ?? "").trim() : "";
}

async function convertOne(mode, header, cols) {
  // Ưu tiên mã; sau đó tên (kèm huyện/tỉnh nếu có)
  const oldCode = getCol(cols, header, "old_ward_code");
  const newCode = getCol(cols, header, "new_ward_code");

  const oldWard = getCol(cols, header, "old_ward_name");
  const oldDist = getCol(cols, header, "old_district_name");
  const oldProv = getCol(cols, header, "old_province_name");

  const newWard = getCol(cols, header, "new_ward_name");
  const newProv = getCol(cols, header, "new_province_name");
  const anyWard = getCol(cols, header, "ward_name");
  const anyDist = getCol(cols, header, "district_name");
  const anyProv = getCol(cols, header, "province_name");

  let out = {
    old_ward_code: "", old_ward_name: "", old_district_name: "", old_province_name: "",
    new_ward_code: "", new_ward_name: "", new_province_name: "",
    direction: ""
  };

  try {
    if (mode === "old2new") {
      // 1) có code cũ
      if (oldCode) {
        const r = await convertOldToNew({ wardCode: oldCode });
        if (r) {
          out = { ...out,
            old_ward_code: r.old.wardCode ?? oldCode,
            old_ward_name: r.old.wardName ?? "",
            old_district_name: r.old.districtName ?? "",
            old_province_name: r.old.provinceName ?? "",
            new_ward_code: r.new.wardCode ?? "",
            new_ward_name: r.new.wardName ?? "",
            new_province_name: r.new.provinceName ?? "",
            direction: "old->new"
          };
          return out;
        }
      }
      // 2) có tên cũ
      const wardName = oldWard || anyWard;
      const districtName = oldDist || anyDist;
      const provinceName = oldProv || anyProv;
      if (wardName || districtName || provinceName) {
        const r = await convertOldToNew({ wardName, districtName, provinceName });
        if (r) {
          out = { ...out,
            old_ward_code: r.old.wardCode ?? "",
            old_ward_name: r.old.wardName ?? wardName ?? "",
            old_district_name: r.old.districtName ?? districtName ?? "",
            old_province_name: r.old.provinceName ?? provinceName ?? "",
            new_ward_code: r.new.wardCode ?? "",
            new_ward_name: r.new.wardName ?? "",
            new_province_name: r.new.provinceName ?? "",
            direction: "old->new"
          };
          return out;
        }
      }
    } else {
      // new2old
      if (newCode) {
        const r = await convertNewToOld({ wardCode: newCode });
        if (r) {
          out = { ...out,
            old_ward_code: r.old.wardCode ?? "",
            old_ward_name: r.old.wardName ?? "",
            old_district_name: r.old.districtName ?? "",
            old_province_name: r.old.provinceName ?? "",
            new_ward_code: r.new.wardCode ?? newCode,
            new_ward_name: r.new.wardName ?? "",
            new_province_name: r.new.provinceName ?? "",
            direction: "new->old"
          };
          return out;
        }
      }
      const wardName = newWard || anyWard;
      const provinceName = newProv || anyProv;
      if (wardName || provinceName) {
        const r = await convertNewToOld({ wardName, provinceName });
        if (r) {
          out = { ...out,
            old_ward_code: r.old.wardCode ?? "",
            old_ward_name: r.old.wardName ?? "",
            old_district_name: r.old.districtName ?? "",
            old_province_name: r.old.provinceName ?? "",
            new_ward_code: r.new.wardCode ?? "",
            new_ward_name: r.new.wardName ?? wardName ?? "",
            new_province_name: r.new.provinceName ?? provinceName ?? "",
            direction: "new->old"
          };
          return out;
        }
      }
    }
  } catch (e) {
    // bỏ qua lỗi từng dòng, trả rỗng
  }
  return out; // không tìm thấy
}

async function main() {
  const modeEl = $("#mode");
  const inputEl = $("#input");
  const outputEl = $("#output");
  const noHeaderEl = $("#noHeader");

  $("#convertBtn").addEventListener("click", async () => {
    outputEl.textContent = "Đang xử lý...";
    const { header, rows } = parseTable(inputEl.value);
    const results = [];
    // header xuất
    const outHeader = [
      "old_ward_code","old_ward_name","old_district_name","old_province_name",
      "new_ward_code","new_ward_name","new_province_name","direction"
    ];
    if (!noHeaderEl.checked) results.push(outHeader);

    for (const r of rows) {
      const mapped = await convertOne(modeEl.value, header, r);
      results.push([
        mapped.old_ward_code, mapped.old_ward_name, mapped.old_district_name, mapped.old_province_name,
        mapped.new_ward_code, mapped.new_ward_name, mapped.new_province_name, mapped.direction
      ]);
    }
    outputEl.textContent = joinTSV(results);
  });

  $("#copyBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#output").textContent || "");
    alert("Đã copy TSV vào clipboard");
  });
}

main();
