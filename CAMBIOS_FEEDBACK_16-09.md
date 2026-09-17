Kash Rampage Extreme - Cambios aplicados por el feedback de Stake del 16-09

Fecha de trabajo: 16 de septiembre de 2026


Resumen

Stake devolvio seis observaciones. Ninguna era de matematica ni de mecanica de juego: eran
fugas de informacion tecnica en pantalla, textos de las reglas que no cumplian el formato
oficial, espanol filtrado a la version en ingles, y terminos prohibidos para el modo social.
Los seis puntos quedaron resueltos y verificados sobre la version compilada.

La matematica no se modifico. No hace falta generar ni volver a subir el paquete de math.


1. El juego debe usar el parametro rgs_url y, si es invalido, mostrar solo un mensaje simple
sin detalles tecnicos

Con un rgs_url invalido el juego mostraba una caja con el error tecnico completo, y dentro de
ese texto viajaban el identificador de sesion y la direccion del servidor. Ahora la ventana de
error muestra unicamente "Failed to fetch. Please reload the game to keep playing.". El
detalle tecnico solo existe en el entorno de desarrollo del equipo; en la version publicada no
se imprime nunca.

El criterio quedo invertido a proposito: en vez de adivinar que mensajes son seguros de
mostrar, solo se muestra el texto cuando quien genera el error lo marca explicitamente como
apto para el jugador. Se dejo marcado el unico caso que corresponde, la ronda de replay que no
se puede cargar, para que ese aviso util no se pierda.

Tambien se elimino un caso donde la respuesta completa del servidor se volcaba dentro del
mismo cartel de error.


2. El tile 16:9 es demasiado oscuro y choca con el fondo de Stake

El fondo que se usaba tenia un brillo medio de 23, cuando el fondo de la plataforma Stake esta
en 41. Era mas oscuro que el fondo sobre el que se apoya.

El equipo de arte entrego una escena nueva, con fuego y mucha mas luz, que mide 55.4 de brillo
medio. Queda claramente por encima del fondo de Stake y ya no se pierde.


3. La informacion del juego debe tener una descripcion de cada modo

La tabla de modos mostraba costo, RTP, maximo y frecuencia, pero ninguna descripcion real. Se
agrego una descripcion para cada uno de los cuatro modos, BASE, VAULT CRACK, SMASH MODE y RAGE
MODE, en ingles y en espanol. BASE no tenia ninguna y ahora la tiene.

Aprovechando el cambio se unifico de donde salen estos datos. Antes los cuatro modos estaban
escritos a mano en tres lugares distintos que podian desincronizarse, y de hecho se habian
desincronizado, que es el origen del punto 5. Ahora hay un unico archivo que alimenta la tabla
en ingles, la tabla en espanol, las tarjetas del menu de compra y la informacion interna del
juego. Cambiar un numero se hace en un solo lugar. Se agrego ademas una verificacion
automatica que avisa al equipo si algun valor deja de coincidir con la configuracion de la
matematica.


4. Usar el disclaimer oficial de la documentacion

Se reemplazo el aviso legal por el texto oficial de Stake, palabra por palabra. Se verifico de
forma automatica que coincide caracter por caracter con el template, incluida la linea final
"TM and (c) 2026 Engine.", que era justamente lo que el revisor habia marcado como diferente.

El copyright del estudio se movio a un parrafo aparte, debajo, para no alterar el texto
oficial. En la version en espanol se muestra el mismo parrafo en ingles: el requisito es que
sea textual, y una traduccion deja de serlo.


5. Aparece texto en espanol dentro de la version en ingles

La fila BASE de la tabla en ingles decia "puede golpear en cualquier spin / can strike on any
spin". Era una celda copiada de la tabla en espanol. Con la unificacion del punto 3 el problema
desaparece por construccion: cada idioma toma su propio texto y ya no es posible mezclarlos.

Se encontraron ademas nueve etiquetas de accesibilidad en espanol que estaban visibles para
lectores de pantalla en la version en ingles: Cerrar, Subir apuesta, Bajar apuesta y Elegir
apuesta. Se tradujeron todas. Se hizo un barrido completo del codigo y no queda nada en espanol
fuera de la seccion que corresponde.


6. No deben aparecer palabras restringidas en modo social

El juego ya tenia un mecanismo que reemplaza los terminos prohibidos en vivo, pero solo
funciona sobre texto normal de la pagina. Habia dos superficies que no alcanzaba.

La primera: el panel derecho del replay mostraba BET dibujado directamente sobre el lienzo del
juego, que para ese mecanismo es invisible. Es exactamente lo que fotografio el revisor. Se
corrigio en el origen, reutilizando el mismo diccionario, de modo que en modo social dice PLAY.
Lo mismo se aplico a las etiquetas de accesibilidad, que tampoco eran alcanzables.

La segunda: el texto de la animacion de introduccion, que viaja dibujado dentro de la imagen y
por lo tanto no se puede reemplazar por software. Decia "THE CREW NEEDS CASH AND NEW
IDENTITIES" y "ANSWER EVERY LOSS WITH A BIGGER BET". El equipo de arte rehizo la animacion y
hoy dice "THE CREW NEEDS COINS AND NEW IDENTITIES" y "ANSWER EVERY LOSS WITH A BIGGER
CHALLENGE". Se regenero la animacion del juego a partir del material nuevo, conservando el
mismo encuadre, y se verifico el texto completo contra la tabla oficial de terminos
prohibidos: no queda ninguno.

Se auditaron ademas todas las imagenes del juego que tienen texto dibujado, botones, titulos,
paneles y carteles de premio. Salvo la introduccion, ya corregida, ninguna otra tenia terminos
restringidos.


Correcciones adicionales

Se limpiaron los mensajes tecnicos que quedaban escritos en la consola del navegador. La
consola debe estar completamente vacia en la version publicada, y esto ya habia sido motivo de
rechazo en una entrega anterior. En el paquete compilado no queda ninguna llamada a consola.

Se saco del paquete el arte sobrante de Kash Smash que seguia viajando dentro de este juego,
16 MB con la marca de otro titulo. Se movio fuera de la carpeta que se publica, sin borrarlo.

Se recomprimio el fondo del tablero, que habia pasado a 3.2 MB con el reemplazo de arte. Quedo
en 0.9 MB sin diferencia visible y sin perder brillo.

Se verifico una sospecha de inconsistencia entre las frecuencias declaradas en las reglas, 1 de
cada 6.6, 4.1 y 2.2, y las de la configuracion de la matematica, 1 de cada 8, 5 y 2.3. No hay
error: son dos cosas distintas. La segunda es la probabilidad configurada antes del proceso de
optimizacion, y la primera es la frecuencia real que recibe el jugador, medida sobre los
resultados publicados. Las reglas publican la correcta.


Verificacion sobre el paquete compilado

La compilacion de produccion termina sin errores. Sobre el paquete generado se confirmo:

El texto mezclado espanol-ingles ya no existe. Cada idioma tiene su propia version.

El disclaimer aparece con la linea oficial "TM and (c) 2026 Engine." y no queda rastro de la
version anterior.

El mensaje generico de error esta presente y no queda ninguna impresion de detalle tecnico.

Las cuatro descripciones de modo estan incluidas.

Cero llamadas a consola.

El arte sobrante de Kash Smash ya no forma parte del paquete.


Entregable

BUILD/frontend_kash-rampage-extreme.zip, 209.6 MB, 170 archivos, con index.html en la raiz.

El paquete de matematica no cambia.
