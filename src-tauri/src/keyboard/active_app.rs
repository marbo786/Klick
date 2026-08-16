#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, MAX_PATH};
#[cfg(windows)]
use windows_sys::Win32::System::ProcessStatus::GetProcessImageFileNameW;
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

#[cfg(windows)]
pub fn get_active_app_name() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return None;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }

        let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process_handle == 0 {
            return None;
        }

        let mut buffer = [0u16; MAX_PATH as usize];
        let len = GetProcessImageFileNameW(process_handle, buffer.as_mut_ptr(), buffer.len() as u32);
        
        CloseHandle(process_handle);

        if len > 0 {
            let path = String::from_utf16_lossy(&buffer[..len as usize]);
            // Extract just the executable name
            if let Some(pos) = path.rfind('\\') {
                return Some(path[pos + 1..].to_string());
            }
            return Some(path);
        }
        None
    }
}

#[cfg(not(windows))]
pub fn get_active_app_name() -> Option<String> {
    None
}
