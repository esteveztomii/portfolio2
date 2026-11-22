@echo off
rem Crea las miniaturas (posters) de tus videos. Requiere ffmpeg instalado (https://ffmpeg.org).
rem Ejecutalo desde esta carpeta (la que tiene index.html). Si no tenés ffmpeg, mandame los videos y te las hago.
if not exist images\posters mkdir images\posters
for %%v in (video1 video3 reel1 reel3 animacion realidad_aumentada visuales_interactivos) do (
  if exist videos\%%v.mp4 ffmpeg -y -v error -ss 1 -i videos\%%v.mp4 -frames:v 1 -vf scale=960:-2 -q:v 4 images\posters\%%v.jpg
)
echo Listo.
pause
