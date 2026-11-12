// views/invoice-template.js
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function buildInvoiceHTML(issueData, companyInfo = {}, items) {
    // 计算客户编号
    let customerNumber = '';
    if (issueData.customer_id) {
        // 长期客户：基于 customer_id 生成 K + 6位数字
        const padded = String(issueData.customer_id).padStart(6, '0');
        customerNumber = `K${padded}`;
    } else {
        // 临时客户：生成 TYYMMDD-XXXX
        const now = new Date();
        const yy = now.getFullYear().toString().slice(2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const datePart = `${yy}${mm}${dd}`;
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        customerNumber = `T${datePart}-${randomPart}`;
        // 注意：极低概率重复，如需严格去重可增加检查，但个体户场景足够
    }
    // 计算汇总金额
    let totalNet = 0, totalTax = 0;
    for (const item of items) {
        const net = item.selling_net_price * item.quantity;
        const tax = net * item.tax_rate / 100;
        totalNet += net;
        totalTax += tax;
    }
    const gross = totalNet + totalTax;
    const vatRate = issueData.is_export ? 0 : 19;
    // 商品表格行
    let itemsHtml = '';
    items.forEach((item, idx) => {
        const netPrice = item.selling_net_price;
        const quantity = item.quantity;
        const totalGross = issueData.is_export ? netPrice * quantity : netPrice * quantity * 1.19;
        itemsHtml += `
            <tr>
                <td style="text-align:center">${idx+1}</td>
                <td>${escapeHtml(item.product_name)}</td>
                <td style="text-align:right">${netPrice.toFixed(2)}</td>
                <td style="text-align:center">${quantity}</td>
                <td style="text-align:right">${totalGross.toFixed(2)}</td>
            </tr>
        `;
    });
    // 右上角公司信息
    const companyLines = [
        companyInfo.name || '',
        companyInfo.street || '',
        `${companyInfo.postcode || ''} ${companyInfo.city || ''}`,
        `USt-IdNr.: ${companyInfo.ustIdNumber || ''}`
    ];
    // 左上角客户地址
    let customerAddressHtml = '';
    if (issueData.customer_name) {
        customerAddressHtml += `${escapeHtml(issueData.customer_name)}<br>`;
    }
    if (issueData.customer_address) {
        customerAddressHtml += issueData.customer_address.replace(/\n/g, '<br>');
    }
    if (issueData.customer_vat_id) {
        customerAddressHtml += `<br>USt-IdNr.: ${escapeHtml(issueData.customer_vat_id)}`;
    }
    // 付款截止日期
    let paymentDeadlineDE = '';
    if (issueData.date) {
        const invoiceDate = new Date(issueData.date);
        const paymentDate = new Date(invoiceDate);
        paymentDate.setDate(invoiceDate.getDate() + 14);
        const paymentDateStr = paymentDate.toISOString().slice(0,10);
        paymentDeadlineDE = utils.formatDateToDE(paymentDateStr);
    }

    const invoiceDateDE = utils.formatDateToDE(issueData.date);
    const serviceDateDE = utils.formatDateToDE(issueData.shipping_date || issueData.date);

    return `<!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <title>Rechnung ${escapeHtml(issueData.invoice_number)}</title>
        <style>
            /* 重置所有边距, 确保PDF高度准确 */
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            html, body {
                height: 100%;
                margin: 0;
                padding: 0;
            }
            body {
                font-family: 'Helvetica', 'Arial', sans-serif;
                background: white;
                padding: 30px 35px;
                font-size: 12px;
                line-height: 1.4;
            }
            /* 发票容器：弹性列，最小高度占满整页 */
            .invoice {
                max-width: 1100px;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                min-height: 100%;    /* 至少占满一页 */
            }
            /* 主要内容区域：自动撑开 */
            .invoice-content {
                flex: 1;
            }
            /* 页脚: 通过margin-top: auto 推到底部 */
            .footer-three-cols {
                margin-top: auto;
                display: flex;
                justify-content: space-between;
                padding-top: 15px;
                border-top: 1px solid #dee2e6;
                font-size: 10px;
            }
            .footer-col {
                flex: 1;
                text-align: left;
            }
            /* 其他样式保持不变（从您原来的样式复制） */
            .invoice-top { display: flex; justify-content: flex-end; margin-bottom: 30px; }
            .company-info { text-align: right; font-size: 12px; line-height: 1.4; max-width: 280px; }
            .invoice-second-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .customer-address { font-size: 12px; line-height: 1.4; max-width: 280px; }
            .rechnung-title { text-align: center; margin: 20px 0; }
            .rechnung-title h1 { font-size: 28px; font-weight: bold; }
            .invoice-meta-row { display: flex; justify-content: space-between; margin-bottom: 25px; padding-bottom: 10px; border-bottom: 1px solid #dee2e6; }
            .meta-item { font-size: 12px; }
            .meta-label { font-weight: bold; margin-right: 8px; }
            .thanks { margin-bottom: 20px; font-size: 12px; }
            .items-table { width: 100%; border-collapse: collapse; margin: 20px 0 8px 0; font-size: 12px; }
            .items-table th, .items-table td { border: 1px solid #000; padding: 8px 6px; vertical-align: top; }
            .items-table th { background-color: #f1f3f5; font-weight: bold; text-align: center; }
            .price-note { font-size: 10px; color: #495057; margin: 0 0 15px 0; }
            .amounts { text-align: right; margin: 0 0 60px 0; font-size: 12px; line-height: 1.4; }
            .amounts p { display: flex; justify-content: flex-end; margin: 2px 0; }
            .amounts .amount-label { text-align: left; width: 130px; margin-right: 20px; }
            .amounts .amount-value { text-align: right; min-width: 80px; }
            .payment-terms { margin: 0 0 8px 0; font-size: 12px; }
            .service-date { margin: 0 0 32px 0; font-size: 12px; }
            .agb-note { margin: 0 0 0 0; font-size: 10px; color: #6c757d; }
        </style>
    </head>
    <body>
    <div class="invoice">
        <div class="invoice-content">
            <div class="invoice-top">
                <div class="company-info">${companyLines.filter(l => l).join('<br>')}</div>
            </div>
            <div class="invoice-second-row">
                <div class="customer-address">${customerAddressHtml}</div>
                <div></div>
            </div>
            <div class="rechnung-title"><h1>Rechnung</h1></div>
            <div class="invoice-meta-row">
                <div class="meta-item"><span class="meta-label">Rechnung Nr.:</span> ${escapeHtml(issueData.invoice_number)}</div>
                <div class="meta-item"><span class="meta-label">Kunde Nr.:</span> ${escapeHtml(customerNumber || '')}</div>
                <div class="meta-item"><span class="meta-label">Datum:</span> ${escapeHtml(invoiceDateDE)}</div>
            </div>
            <div class="thanks">vielen Dank für Ihren Auftrag. Vereinbarungsgemäß berechnen wir Ihnen hiermit folgende Leistungen:</div>
            <table class="items-table">
                <thead><tr><th style="width:5%">Pos</th><th style="width:45%">Beschreibung</th><th style="width:20%">Einzelpreis (€)</th><th style="width:10%">Anzahl</th><th style="width:20%">Gesamtpreis (€)</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="price-note">${issueData.is_export ? 'Preise verstehen sich als Nettopreise ohne Umsatzsteuer (steuerfreie Lieferung).' : 'Preise verstehen sich zzgl. der gesetzlichen Umsatzsteuer.'}</div>
            <div class="amounts">
                <p><span class="amount-label">Nettobetrag:</span> <span class="amount-value">${totalNet.toFixed(2).replace('.',',')}</span> €</p>
                <p><span class="amount-label">zzgl. ${vatRate}% MwSt.:</span> <span class="amount-value">${totalTax.toFixed(2).replace('.',',')}</span> €</p>
                <p class="total"><span class="amount-label">Gesamtbetrag:</span> <strong class="amount-value">${gross.toFixed(2).replace('.',',')}</strong> €</p>
            </div>
            <div class="payment-terms"><p>Der Gesamtbetrag ist bis zum ${paymentDeadlineDE} auf unser unten genanntes Konto zu zahlen.</p></div>
            <div class="service-date"><strong>Leistungsdatum (voraussichtlicher Versand):</strong> ${escapeHtml(serviceDateDE)}</div>
            <div class="agb-note">Die aufgeführten Dienstleistungen haben Sie gemäß unserer AGB erhalten. Wenn nicht anders angegeben entspricht das Leistungsdatum dem Rechnungsdatum. Für weitere Fragen stehen wir Ihnen sehr gerne zur Verfügung.</div>
        </div>
    
        <div class="footer-three-cols">
            <div class="footer-col">${escapeHtml(companyInfo.name)}<br>${escapeHtml(companyInfo.street)}<br>${escapeHtml(companyInfo.postcode)} ${escapeHtml(companyInfo.city)}</div>
            <div class="footer-col">Steuernummer: ${escapeHtml(companyInfo.taxNumber || '')}<br>USt-IdNr.: ${escapeHtml(companyInfo.ustIdNumber || '')}</div>
            <div class="footer-col">${escapeHtml(companyInfo.bank || '')}<br>IBAN: ${escapeHtml(companyInfo.iban || '')}<br>BIC: ${escapeHtml(companyInfo.bic || '')}</div>
        </div>
    </div>
    </body>
    </html>`;
}

module.exports = { buildInvoiceHTML };