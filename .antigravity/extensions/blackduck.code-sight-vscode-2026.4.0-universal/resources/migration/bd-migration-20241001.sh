#!/bin/bash
# Copyright 2024 Black Duck Software, Inc. All rights reserved.

WORKING_DIR_PARENT="${HOME}/.blackduck"
OLD_WORKING_DIR_PARENT="${HOME}/.synopsys"
CODE_SIGHT_PLUGIN_JSON_FILE="code_sight_plugin.json"
WORKING_SUBDIR="desktop"

# if new working directory already exists, do nothing
if [ -d "${WORKING_DIR_PARENT}/${WORKING_SUBDIR}" ]; then
  echo "Migration has already been completed. Exiting"
  exit 0
fi

# if neither old working directory nor code_sight_plugin.json file exists, do nothing
if [ ! -d "${OLD_WORKING_DIR_PARENT}/${WORKING_SUBDIR}" ] && [ ! -f "${OLD_WORKING_DIR_PARENT}/${CODE_SIGHT_PLUGIN_JSON_FILE}" ]; then
  echo "There is nothing to migrate. Exiting"
  exit 0
fi

echo "Proceeding with migration"

# create parent directory if it does not exist
if [ ! -d "${WORKING_DIR_PARENT}" ]; then
  mkdir "${WORKING_DIR_PARENT}"
fi

if [ ! -d "${WORKING_DIR_PARENT}" ]; then
  echo "Failed to create the working directory parent folder. Exiting"
  exit 1
fi

# move code_sight_plugin.json file
if [ -f "${OLD_WORKING_DIR_PARENT}/${CODE_SIGHT_PLUGIN_JSON_FILE}" ]; then
  echo "Moving custom Code Sight working directory file to the new default location"
  mv "${OLD_WORKING_DIR_PARENT}/${CODE_SIGHT_PLUGIN_JSON_FILE}" "${WORKING_DIR_PARENT}/"

  if [ ! -f "${WORKING_DIR_PARENT}/${CODE_SIGHT_PLUGIN_JSON_FILE}" ]; then
    echo "Failed to move the custom Code Sight working directory file to the new default location. Exiting"
    exit 1
  fi
fi

# move working directory folder
if [ -d "${OLD_WORKING_DIR_PARENT}/${WORKING_SUBDIR}" ] ; then
  echo "Moving working directory to the new default location"
  mv "${OLD_WORKING_DIR_PARENT}/${WORKING_SUBDIR}" "${WORKING_DIR_PARENT}/"

  if [ ! -d "${WORKING_DIR_PARENT}/${WORKING_SUBDIR}" ]; then
    echo "Failed to move the working directory to the new default location. Exiting"
    exit 1
  fi
fi

echo "Migration complete"
exit 0
