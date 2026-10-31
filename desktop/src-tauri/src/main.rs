// Sin consola extra en Windows en las versiones publicadas.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lost_and_prompt_lib::run()
}
