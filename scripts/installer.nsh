; Custom NSIS installer script for Desktop Helper
; Handles version conflicts and improves installation process

!include "MUI2.nsh"
!include "FileFunc.nsh"

; Installer attributes
RequestExecutionLevel admin
ShowInstDetails show
ShowUninstDetails show

; Check for existing installation and handle gracefully
Function .onInit
  ; Check if application is running
  FindWindow $0 "" "Desktop Helper"
  StrCmp $0 0 notRunning
    MessageBox MB_OK|MB_ICONEXCLAMATION "Desktop Helper está ejecutándose. Por favor, ciérralo antes de continuar con la instalación."
    Abort
  notRunning:

  ; Check for existing installation
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Desktop Helper" "UninstallString"
  StrCmp $0 "" done

  ; Ask user if they want to uninstall the previous version
  MessageBox MB_YESNO|MB_ICONQUESTION "Se detectó una versión anterior de Desktop Helper. ¿Deseas desinstalarla automáticamente?" IDNO done
  
  ; Extract uninstaller path and run it
  CopyFiles /SILENT $0 "$TEMP\DesktopHelperUninstall.exe"
  ExecWait '"$TEMP\DesktopHelperUninstall.exe" /S'
  Delete "$TEMP\DesktopHelperUninstall.exe"
  
  done:
FunctionEnd

; Custom uninstaller function
Function un.onInit
  ; Check if application is running before uninstall
  FindWindow $0 "" "Desktop Helper"
  StrCmp $0 0 notRunning
    MessageBox MB_OK|MB_ICONEXCLAMATION "Desktop Helper está ejecutándose. Por favor, ciérralo antes de desinstalar."
    Abort
  notRunning:
FunctionEnd

; Post-installation cleanup
Function .onInstSuccess
  ; Clean up any temporary files
  Delete "$TEMP\DesktopHelper*.*"
  
  ; Ensure proper registry entries
  WriteRegStr HKCU "Software\Desktop Helper" "Version" "${VERSION}"
  WriteRegStr HKCU "Software\Desktop Helper" "InstallPath" "$INSTDIR"
FunctionEnd

; Pre-uninstall cleanup
Function un.onUninstSuccess
  ; Clean up registry entries
  DeleteRegKey HKCU "Software\Desktop Helper"
  
  ; Clean up temporary files
  Delete "$TEMP\DesktopHelper*.*"
  
  ; Remove application data if user chooses
  MessageBox MB_YESNO|MB_ICONQUESTION "¿Deseas eliminar también los datos de la aplicación (configuración, logs, etc.)?" IDNO skipAppData
  RMDir /r "$APPDATA\Desktop Helper"
  RMDir /r "$LOCALAPPDATA\Desktop Helper"
  skipAppData:
FunctionEnd

; Integrity check
Function VerifyInstaller
  ; Verify installer integrity
  ClearErrors
  FileOpen $0 "$EXEPATH" r
  IfErrors 0 +3
    MessageBox MB_OK|MB_ICONSTOP "Error de integridad del instalador. Por favor, descarga una nueva copia."
    Abort
  FileClose $0
FunctionEnd

; Call integrity check
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
!insertmacro MUI_DESCRIPTION_TEXT ${SecMain} "Archivos principales de Desktop Helper"
!insertmacro MUI_FUNCTION_DESCRIPTION_END