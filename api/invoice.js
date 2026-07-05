 // File: api/invoice.js
// Serverless function for auto-incrementing invoice numbers

import fs from 'fs';
import path from 'path';

// Use /tmp for Vercel (ephemeral but persists between function calls)
const COUNTER_FILE = path.join('/tmp', 'invoice-counter.json');

// Helper to get counter with fallback
function getCounter() {
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            const data = fs.readFileSync(COUNTER_FILE, 'utf8');
            const parsed = JSON.parse(data);
            return parsed.last_id || 0;
        }
    } catch (error) {
        console.log('Counter file read error:', error);
    }
    return 0;
}

// Helper to save counter
function saveCounter(id) {
    try {
        fs.writeFileSync(COUNTER_FILE, JSON.stringify({ last_id: id }));
        return true;
    } catch (error) {
        console.log('Counter file write error:', error);
        return false;
    }
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    
    try {
        // Get current counter
        let lastId = getCounter();
        
        // Increment
        const nextId = lastId + 1;
        
        // Generate invoice number with YYYYMMDD format
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const datePart = `${year}${month}${day}`;
        const paddedId = String(nextId).padStart(3, '0');
        const invoiceNumber = `AIIS/${datePart}/${paddedId}`;
        
        // Save counter
        const saved = saveCounter(nextId);
        
        console.log(`📄 Generated invoice: ${invoiceNumber} (ID: ${nextId}, Saved: ${saved})`);
        
        res.status(200).json({
            success: true,
            invoice_number: invoiceNumber,
            id: nextId
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}