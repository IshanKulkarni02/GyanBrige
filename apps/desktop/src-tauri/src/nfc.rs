// USB NFC reader (ACR122U-class) via pcsc-lite.
// Returns the raw card UID as hex; the web client signs it and sends to the API.

use pcsc::{Context, Scope, ShareMode, Protocols, MAX_BUFFER_SIZE};

#[tauri::command]
pub fn list_readers() -> Result<Vec<String>, String> {
    let ctx = Context::establish(Scope::User).map_err(|e| e.to_string())?;
    let mut buf = [0u8; 2048];
    let readers = ctx.list_readers(&mut buf).map_err(|e| e.to_string())?;
    Ok(readers.map(|r| r.to_string_lossy().into_owned()).collect())
}

#[tauri::command]
pub fn read_nfc_once(reader_name: Option<String>) -> Result<String, String> {
    let ctx = Context::establish(Scope::User).map_err(|e| e.to_string())?;
    let mut buf = [0u8; 2048];
    let mut readers_iter = ctx.list_readers(&mut buf).map_err(|e| e.to_string())?;
    let reader = match reader_name {
        Some(name) => readers_iter
            .find(|r| r.to_string_lossy() == name)
            .ok_or_else(|| "Reader not found".to_string())?,
        None => readers_iter.next().ok_or_else(|| "No readers attached".to_string())?,
    };

    let card = ctx
        .connect(reader, ShareMode::Shared, Protocols::ANY)
        .map_err(|e| e.to_string())?;

    // GET DATA command: FF CA 00 00 00 returns UID for most contactless cards
    let apdu = [0xFFu8, 0xCA, 0x00, 0x00, 0x00];
    let mut rapdu = [0u8; MAX_BUFFER_SIZE];
    let resp = card.transmit(&apdu, &mut rapdu).map_err(|e| e.to_string())?;
    if resp.len() < 2 {
        return Err("Short response from card".into());
    }
    let (uid, sw) = resp.split_at(resp.len() - 2);
    if sw != [0x90, 0x00] {
        return Err(format!("APDU error: {:02X}{:02X}", sw[0], sw[1]));
    }
    Ok(hex::encode_upper(uid))
}
