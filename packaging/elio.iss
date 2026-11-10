; Inno Setup-script voor het Windows-installatieprogramma van Elio.
; Bouwen (na PyInstaller):  iscc /DAppVersie=0.1.0 packaging\elio.iss
; Resultaat: dist\Elio-Setup-<versie>.exe

#ifndef AppVersie
  #define AppVersie "0.0.0"
#endif

[Setup]
; Vaste id: zo herkent Windows een nieuwe versie als update van dezelfde app
AppId={{0F403A0C-1E5B-4F27-B61D-A084FC080009}
AppName=Elio
AppVersion={#AppVersie}
AppVerName=Elio {#AppVersie}
AppPublisher=penny707
AppPublisherURL=https://github.com/penny707/Productivity-App
AppSupportURL=https://github.com/penny707/Productivity-App/issues
; Per gebruiker installeren: geen beheerdersrechten nodig
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\Elio
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=Elio-Setup-{#AppVersie}
SetupIconFile=..\static\icon.ico
UninstallDisplayIcon={app}\Elio.exe
UninstallDisplayName=Elio
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "dutch"; MessagesFile: "compiler:Languages\Dutch.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\Elio\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Elio"; Filename: "{app}\Elio.exe"
Name: "{autodesktop}\Elio"; Filename: "{app}\Elio.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Elio.exe"; Description: "{cm:LaunchProgram,Elio}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Eerst de achtergrondserver stoppen, anders zijn de bestanden nog in gebruik
Filename: "{app}\Elio.exe"; Parameters: "--stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopElio"

; Je gegevens (in %APPDATA%\Elio) blijven bij het verwijderen gewoon staan.

[Code]
// Bij een update: de draaiende Elio stoppen voordat bestanden vervangen worden
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  if FileExists(ExpandConstant('{app}\Elio.exe')) then
    Exec(ExpandConstant('{app}\Elio.exe'), '--stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;
