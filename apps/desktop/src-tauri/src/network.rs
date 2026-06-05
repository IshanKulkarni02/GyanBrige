// Network info for attendance verification.
// Returns the current WiFi SSID and BSSID so the app can call
// POST /api/attendance/network without the student having to type anything.
// Uses platform shell commands — no extra Cargo dependencies needed.

use std::process::Command;

#[derive(serde::Serialize)]
pub struct NetworkInfo {
    pub ssid: Option<String>,
    pub bssid: Option<String>,
    pub ip: Option<String>,
}

#[tauri::command]
pub fn get_network_info() -> Result<NetworkInfo, String> {
    #[cfg(target_os = "macos")]
    return get_network_info_macos();

    #[cfg(target_os = "windows")]
    return get_network_info_windows();

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    return Ok(NetworkInfo { ssid: None, bssid: None, ip: None });
}

#[cfg(target_os = "macos")]
fn get_network_info_macos() -> Result<NetworkInfo, String> {
    // airport CLI ships with macOS
    let airport = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";
    let out = Command::new(airport)
        .arg("-I")
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out.stdout);

    let ssid = text.lines()
        .find(|l| l.trim_start().starts_with("SSID:") && !l.contains("BSSID"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string());

    let bssid = text.lines()
        .find(|l| l.trim_start().starts_with("BSSID:"))
        .and_then(|l| l.split_once(':'))
        .map(|(_, v)| v.trim().to_string());

    // Get local IP via ifconfig
    let ip_out = Command::new("ifconfig").output().map_err(|e| e.to_string())?;
    let ip_text = String::from_utf8_lossy(&ip_out.stdout);
    let ip = ip_text.lines()
        .filter(|l| l.contains("inet ") && !l.contains("127.0.0.1") && !l.contains("inet6"))
        .filter_map(|l| l.split_whitespace().nth(1))
        .next()
        .map(|s| s.to_string());

    Ok(NetworkInfo { ssid, bssid, ip })
}

#[cfg(target_os = "windows")]
fn get_network_info_windows() -> Result<NetworkInfo, String> {
    let out = Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out.stdout);

    let ssid = text.lines()
        .find(|l| l.trim_start().starts_with("SSID") && !l.contains("BSSID"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string());

    let bssid = text.lines()
        .find(|l| l.trim_start().starts_with("BSSID"))
        .and_then(|l| l.split_once(':'))
        .map(|(_, v)| v.trim().to_string());

    // Local IP via ipconfig
    let ip_out = Command::new("ipconfig").output().map_err(|e| e.to_string())?;
    let ip_text = String::from_utf8_lossy(&ip_out.stdout);
    let ip = ip_text.lines()
        .filter(|l| l.contains("IPv4 Address"))
        .filter_map(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .next();

    Ok(NetworkInfo { ssid, bssid, ip })
}
