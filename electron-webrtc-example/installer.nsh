; AIGuard NSIS installer hook - silently close running agent before install
!macro customCheckAppRunning
  DetailPrint "Checking for running ${PRODUCT_NAME} process..."
  nsExec::ExecToStack 'taskkill /IM "${APP_EXECUTABLE_FILENAME}" /T /F'
  Pop $0
  Pop $1
  ${If} $0 == 0
    DetailPrint "Closed running ${PRODUCT_NAME} process before installation."
    Sleep 1500
  ${Else}
    DetailPrint "No running ${PRODUCT_NAME} process found, or it was already closed."
  ${EndIf}
!macroend