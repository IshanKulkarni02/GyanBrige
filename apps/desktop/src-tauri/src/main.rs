#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod nfc;
mod network;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            nfc::read_nfc_once,
            nfc::list_readers,
            network::get_network_info,
        ])
        .run(tauri::generate_context!())
        .expect("error running gyanbrige desktop");
}
