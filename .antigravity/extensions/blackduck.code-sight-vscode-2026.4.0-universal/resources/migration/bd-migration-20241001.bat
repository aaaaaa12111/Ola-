@echo off
REM Copyright 2024 Black Duck Software, Inc. All rights reserved.

set working_dir_parent=%APPDATA%\BlackDuck
set old_working_dir_parent=%APPDATA%\Synopsys
set code_sight_plugin_json_file=code_sight_plugin.json
set working_subdir=desktop

REM if new working directory already exists, do nothing
if exist "%working_dir_parent%\%working_subdir%" (
  echo Migration has already been completed. Exiting
  exit /b 0
)

REM if neither old working directory nor code_sight_plugin.json file exists, do nothing
if not exist "%old_working_dir_parent%\%working_subdir%" (
  if not exist ""%old_working_dir_parent%\%code_sight_plugin_json_file%"" (
    echo There is nothing to migrate. Exiting
    exit /b 0
  )
)

echo Proceeding with migration

REM create parent directory if it does not exist
if not exist "%working_dir_parent%" (
  mkdir "%working_dir_parent%"
)

if not exist "%working_dir_parent%" (
  echo Failed to create the working directory parent folder. Exiting
  exit /b 1
)

REM move code_sight_plugin.json file
if exist "%old_working_dir_parent%\%code_sight_plugin_json_file%" (
  REM update ownership of code_sight_plugin.json file for moving
  takeown /f "%old_working_dir_parent%\%code_sight_plugin_json_file%"

  echo Moving custom Code Sight working directory file to the new default location
  move "%old_working_dir_parent%\%code_sight_plugin_json_file%" "%working_dir_parent%\"

  if not exist "%working_dir_parent%\%code_sight_plugin_json_file%" (
    echo Failed to move the custom Code Sight working directory file to the new default location. Exiting
    exit /b 1
  )
)

REM move working directory folder
if exist "%old_working_dir_parent%\%working_subdir%" (
  REM update ownership of Synopsys folder for moving
  takeown /f "%old_working_dir_parent%\%working_subdir%"

  echo Moving working directory to the new default location
  move "%old_working_dir_parent%\%working_subdir%" "%working_dir_parent%\"

  if not exist "%working_dir_parent%\%working_subdir%" (
    echo Failed to move the working directory to the new default location. Exiting
    exit /b 1
  )
)

echo Migration complete
exit /b 0
