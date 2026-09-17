Kash Rampage Extreme - Cambios aplicados por los feedbacks de Stake del 16-09 y del 17-09

Fechas de trabajo: 16 y 17 de septiembre de 2026


Resumen general

Son dos tandas de feedback seguidas. La primera, del 16-09, trajo seis observaciones. La
segunda, del 17-09, trajo cinco mas (seis contando el thumbnail, que no se toca desde el
repositorio). Ninguna de las once fue un problema de matematica.

En la primera tanda todo eran fugas de informacion tecnica en pantalla, textos de reglas
fuera del formato oficial, espanol filtrado a la version en ingles y terminos prohibidos en
modo social. En la segunda hubo dos bugs reales de interfaz que el revisor encontro
reproduciendo rondas concretas, un widget que no se actualizaba, un monto que se mostraba
mal por un redondeo, y un texto de las reglas que contradecia a la matematica.

La matematica no se modifico en ninguna de las dos tandas. No hace falta generar ni volver a
subir el paquete de math: alcanza con subir el frontend. El detalle de por que esta al final,
en la seccion "Evaluacion del paquete de matematica".


PRIMERA TANDA - feedback del 16-09


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


Correcciones adicionales de la primera tanda

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


Verificacion de la primera tanda sobre el paquete compilado

La compilacion de produccion termina sin errores. Sobre el paquete generado se confirmo:

El texto mezclado espanol-ingles ya no existe. Cada idioma tiene su propia version.

El disclaimer aparece con la linea oficial "TM and (c) 2026 Engine." y no queda rastro de la
version anterior.

El mensaje generico de error esta presente y no queda ninguna impresion de detalle tecnico.

Las cuatro descripciones de modo estan incluidas.

Cero llamadas a consola.

El arte sobrante de Kash Smash ya no forma parte del paquete.


SEGUNDA TANDA - feedback del 17-09


7. El thumbnail ancho no cumple los requisitos

Queda fuera de este entregable a proposito. El tile no viaja dentro del juego: se arma en el
Tile Editor del panel de Stake a partir de dos capas que se suben a mano, asi que no hay nada
que compilar. Se trabaja por separado y, segun la documentacion de Stake, cambiarlo no obliga
a repetir la revision del juego.


8. La ventana de replay no debe poder scrollearse

El revisor mando dos capturas: la tarjeta de replay con barra horizontal en escritorio, y con
las dos barras en la vista reducida. Eran dos defectos independientes.

El horizontal aparecia en todas las resoluciones. La caja interior de las filas media mas que
la tarjeta que la contiene, porque sumaba su relleno por fuera del ancho en vez de por dentro.
Como la tarjeta ademas permitia scroll vertical, el navegador habilitaba solo el horizontal.

El vertical aparecia en los tamanos intermedios. La tarjeta solo tenia una version compacta
para pantallas muy bajas, y los tamanos de en medio se quedaban sin cubrir: ahi la tarjeta a
tamano completo no entraba en la altura disponible.

Se resolvieron los dos de raiz. La tarjeta ahora define un unico tamano de letra proporcional
a la altura de la pantalla y todo lo de adentro se mide en relacion a el, de modo que tarjeta
y texto se achican juntos como una sola pieza. Al ser constante la proporcion entre contenido
y contenedor, no queda ninguna resolucion donde el contenido se desborde, y eso es lo que
permite prohibir el scroll en ambos ejes, que es literalmente lo que pidio Stake. Se
eliminaron las versiones compactas por tamano, que eran las que dejaban huecos. En escritorio
y en movil grande la tarjeta se ve igual que antes.

Queda una advertencia para el futuro: prohibir el scroll solo es seguro mientras el contenido
entre en las siete resoluciones oficiales. Si algun dia se agregan filas a esa tarjeta, hay
que volver a medirlas.


9. El campo de apuesta de la barra inferior no es responsive

El revisor fotografio el campo con el monto desbordado sobre los botones de subir y bajar
apuesta: la primera letra tapada por uno y el ultimo digito por el otro.

El hueco central donde va el monto ocupa una fraccion fija del ancho de la pastilla, y el
monto se dibujaba a un tamano fijo, sin limite de ancho. Con montos largos no entraba. No
dependia de la resolucion: la barra entera se escala en bloque, asi que la proporcion entre el
texto y su hueco es siempre la misma, y con monedas de nombre largo o balances de siete cifras
era peor.

Ahora el monto se mide contra el hueco disponible y se ajusta para entrar, de forma uniforme
para no deformar la tipografia. Se mide el ancho real, no una estimacion por cantidad de
caracteres, y se vuelve a medir cuando termina de cargar la fuente de la marca, que carga
tarde y es mas ancha que la de reemplazo: midiendo antes, el monto volvia a desbordarse justo
al aparecer la fuente definitiva.


10. El widget de multiplicador se queda en x1 durante las cascadas

El revisor lo describio con precision: el multiplicador se aplica bien a los pagos, pero el
indicador no acompana, y eso confunde al jugador.

La causa era un cable suelto. Todo el camino del multiplicador en el cliente estaba conectado
a un aviso que esta matematica no emite nunca, heredado de la plantilla de ejemplo con la que
arranco el proyecto. El aviso que si emite estaba recibido por una funcion vacia. Por eso los
pagos salian correctos, porque esos leen el dato por otra via, mientras que el indicador no
recibia nada.

Se conecto el aviso correcto. El momento en que llega ya era el adecuado: la matematica lo
manda justo despues de que caen los simbolos nuevos, que es el instante en que el escalon
tiene que subir. Se agrego ademas el regreso a x1 al empezar cada ronda, porque la matematica
reinicia el multiplicador sin avisar y el indicador se quedaba pegado en el valor de la ronda
anterior. Y se corrigio el mismo problema en la reanudacion: si el jugador recarga en medio de
una tanda de giros gratis, el indicador vuelve ahora al escalon que corresponde en vez de
mostrar x1.

No hubo que tocar el widget en si, que ya estaba bien hecho: solo le faltaba que le llegara
el dato.


11. Ronda 225490 en Smash Mode: la rata muestra 8.19 y la informacion del juego dice 8.2

Confirmado y corregido. El cliente estaba recalculando el monto de la etiqueta en vez de usar
el valor que manda la matematica. El origen es un redondeo: la tabla de pagos define 8.2, y
ese numero no se puede representar exacto en la aritmetica de la maquina, asi que el motor
publica dos versiones del mismo importe, una redondeada y otra truncada. La etiqueta estaba
leyendo la truncada.

Ahora usa el importe autoritativo, que es el que la matematica suma al total de la ronda y el
que sostiene el pago. Se reviso el alcance del problema sobre las 137.693 rondas ganadoras del
modo: el desvio afectaba al 4.69% de los casos.

El mismo arreglo cubre un segundo caso, distinto y mas grave, que aparecio al revisarlo: en
las rondas que tocan el tope maximo de premio, la etiqueta mostraba un importe mayor que el
que efectivamente se acredita.

Se verifico la ronda exacta que reporto el revisor. Tiene una sola diferencia de este tipo y
es justamente la de la rata, y el total de la ronda cierra con el importe correcto.

Al medir el alcance de este arreglo sobre los cuatro modos completos aparecio un caso que la
primera version del arreglo no cubria, y que conviene dejar escrito porque es la misma falla
que reporto Stake, reaparecida en otro lugar. La etiqueta se dibuja como "importe por
multiplicador", asi que el importe se obtiene dividiendo el total entre el multiplicador. Esa
division es exacta en todas las rondas de los cuatro modos menos en una por modo: la del
premio maximo, donde el importe queda recortado al tope y el multiplicador ya no lo divide.
Ahi la etiqueta mostraba el importe con ocho decimales, y ademas multiplicado no daba
exactamente el premio acreditado.

Importa porque es justamente la ronda del premio maximo, que es la que el revisor siempre
prueba. Se corrigio: cuando la division no es exacta, la etiqueta muestra el total exacto sin
la forma "por multiplicador". En una ronda recortada al tope esa forma ya no describe nada,
porque el premio dejo de ser importe por multiplicador en el momento en que se recorto.


12. Ronda 166637 en Rage Mode: un tercer scatter tras una cascada dio giros extra, pero las
reglas decian que los scatters de las cascadas no cuentan

Aca manda la matematica: el texto de las reglas era el que estaba mal.

El juego cuenta los scatters despues de las cascadas, no solo en la caida inicial, tanto para
disparar los giros gratis como para volver a dispararlos. Se comprobo sobre la ronda exacta
del revisor: la caida inicial trae dos scatters, dos cascadas suman uno mas, y ahi se otorgan
los giros adicionales. Es literalmente lo que describio.

Se midio cuanto pesa el efecto antes de decidir: en Rage Mode, uno de cada cuatro
redisparos llega a su tercer scatter recien gracias a las cascadas.

Se decidio corregir el texto y no la matematica. Cambiarla habria obligado a volver a simular
los cuatro modos, a reoptimizar el retorno, a bajar el retorno de los modos de compra al
quitar esos redisparos, y a generar rondas de ejemplo nuevas para la revision, invalidando las
que Stake ya tiene. El comportamiento actual es ademas el estandar del genero. Se corrigio el
texto en las reglas y en la tabla de pagos, en ingles y en espanol, y en la documentacion del
juego.

Durante esta revision aparecio una linea que se habia pasado por alto: la descripcion del
juego seguia diciendo que el redisparo contaba solo en la caida inicial, justo debajo del
parrafo que ya se habia corregido. Es exactamente la contradiccion que marco Stake. Quedo
alineada con el resto.

Una aclaracion para no sobrecorregir: las menciones a la caida inicial que siguen en las
reglas son las del KASH RAMPAGE, y esas si son correctas, porque esa mecanica solo ocurre en
la caida inicial y nunca durante las cascadas.


Verificacion de la segunda tanda

La compilacion de produccion termina sin errores y pasa el verificador automatico del
proyecto, que corre sobre el paquete que se sube y rechaza la entrega si encuentra llamadas a
consola, puntos de interrupcion, mapas de codigo fuente o si falta el mensaje de error
generico. Sobre el paquete generado se confirmo ademas:

El multiplicador esta conectado al aviso correcto y no queda rastro operativo del aviso viejo.

La tarjeta de replay viaja con el tamano de letra proporcional y con el scroll prohibido.

El texto nuevo de los scatters esta presente y el anterior no aparece en ningun archivo.

Las herramientas internas de desarrollo no quedan en el paquete: ni los laboratorios visuales,
ni los accesos de diagnostico, ni la vista de tamanos, que se excluye del zip explicitamente.

No hay direcciones de servidor escritas a mano. El juego toma la del parametro de la URL.

No quedan pedidos a servicios externos. Las unicas direcciones que aparecen son textos de
licencia y de mensajes de error de las librerias, que no generan trafico.

Las dos rondas que reporto el revisor se revisaron contra los datos publicados, no contra una
reconstruccion, y las dos confirman el diagnostico descrito arriba.


Evaluacion del paquete de matematica

No hay que generar ni volver a subir el zip de matematica. Se comprobo de tres formas
independientes:

Primero, por contenido. Desde el commit anterior, dentro de la carpeta de matematica solo
cambiaron dos archivos: el README y un comentario en la configuracion. Los dos son texto
explicativo. No se modifico ni una linea de codigo que intervenga en el resultado.

Segundo, por comparacion directa. Se compararon uno a uno los nueve archivos del zip ya
generado contra los que hay hoy en la carpeta de publicacion, usando una huella digital por
archivo y no solo el tamano. Los nueve son identicos byte a byte.

Tercero, por la naturaleza de las observaciones. Las once de las dos tandas se resolvieron en
el cliente o en textos. La unica que rozaba la matematica, la de los scatters en las cascadas,
se resolvio confirmando que la matematica estaba bien y corrigiendo el texto que la
contradecia.

Hay ademas una razon fuerte para no regenerarla aunque se pudiera: las rondas de ejemplo que
Stake usa para revisar, incluidas las dos que cito en este feedback, son numeros de linea
dentro de los archivos publicados. Si se vuelven a simular, esos numeros apuntan a otras
rondas y el revisor deja de poder reproducir lo que reporto.

El paquete existente se reviso igual y esta en condiciones: declara los cuatro modos con sus
costos y cada modo con su tabla y su archivo de rondas. El archivo mas grande pesa 620 MB,
por debajo del tamano a partir del cual el cargador de Stake recorta archivos. La prueba mas
fuerte de que el paquete esta bien es que Stake ya lo cargo y lo reviso: las dos rondas que
cita este feedback salen de el.


Entregable

BUILD/frontend_kash-rampage-extreme.zip, 209.3 MB, 169 archivos, con index.html en la raiz y
sin la vista de tamanos.

El paquete de matematica no cambia: BUILD/math_kash-rampage-extreme.zip sigue siendo el
vigente.


Pendiente, fuera de este entregable

El thumbnail ancho (punto 7). Se arma en el panel de Stake y no requiere repetir la revision
del juego, asi que puede ir por separado.
