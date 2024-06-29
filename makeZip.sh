#!/bin/sh

NAME=SteamGameTyping

rm -f ${NAME}.zip
zip -r ${NAME}.zip ${NAME}/*.js ${NAME}/*.json ${NAME}/_locales/*/messages.json ${NAME}/icon/icon*.png ${NAME}/*.html ${NAME}/sounds/*.mp3
