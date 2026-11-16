# LibreTranslate

[LibreTranslate](https://libretranslate.com) es un servidor de traducción automática libre y de
código abierto que usted mismo ejecuta. Esta integración permite que sus escenas de Gladys
traduzcan un texto, con información de la escena, y usen la traducción en las acciones
siguientes: enviarla como mensaje o hacer que se lea en voz alta. También reconoce el idioma de
un texto. Todo se queda en su red: sin cuenta, sin nube, sin cuota.

Es la alternativa local a la integración DeepL. También vigila el servidor: en línea o no, su
versión, el número de idiomas cargados, con un widget para el panel.

Sin relación con LibreTranslate. Probada con un servidor LibreTranslate 1.9.6 real.

## Lo que necesita

- Gladys 5.1 o posterior.
- Un servidor LibreTranslate en su red. Con Docker:
  `docker run -d -p 5000:5000 libretranslate/libretranslate --load-only en,fr,de,es`.
  `--load-only` conserva solo los idiomas que necesita: cada par de idiomas es un modelo que
  descargar y mantener en memoria (cuente unos 2 GB de RAM para cuatro idiomas).
- O una instancia pública que le dé una clave de API (libretranslate.com es un servicio de
  pago).

## Configuración

1. En Gladys, abra **Integraciones**, busque **LibreTranslate** e instálela.
2. En **Configuración**, rellene:
   - **Dirección del servidor**: la dirección IP o el nombre del servidor, por ejemplo
     `192.168.1.20` (se añade el puerto 5000), `192.168.1.20:5001` o la URL completa de un
     proxy inverso;
   - **Clave de API (opcional)**: solo si el servidor la exige (iniciado con `--api-keys`, o una
     instancia pública);
   - **Idioma de los nombres**: el idioma de los nombres de las funciones y del nombre de idioma
     que da la detección.
3. Pulse **Probar la conexión**: muestra la versión y los idiomas del servidor y luego traduce
   una palabra para comprobar la clave.
4. En **Descubrimiento**, añada el dispositivo **LibreTranslate** si quiere sus estados en Gladys
   (opcional: las acciones de escena funcionan sin él).

## El dispositivo LibreTranslate

El servidor se lee cada cinco minutos:

- **En línea**: sí cuando el servidor responde; no tras dos lecturas fallidas seguidas, con 15
  segundos de intervalo.
- **Idiomas disponibles**: el número de idiomas que el servidor ha cargado.
- **Versión**: la versión de LibreTranslate.

## Panel

El widget **LibreTranslate** muestra el número de idiomas, las traducciones de las últimas 24
horas, el estado del servidor, la última traducción (idiomas y hora) y la lista de idiomas. Unos
ajustes ocultan las cifras, la última traducción y la lista.

## Escenas

### Acciones

- **LibreTranslate: traducir un texto**:
  - **Texto a traducir**: escriba `{{` para insertar información de la escena, por ejemplo un
    valor del disparador o el mensaje recibido;
  - **Hacia**: el idioma de la traducción;
  - **Desde**: vacío para que el servidor lo detecte.

  Sus resultados están disponibles para las acciones siguientes: **Traducción**
  (`{{0.1.translation}}` para la primera acción de la segunda fila) e **Idioma de origen
  (código)** (`{{0.1.source_language}}`, por ejemplo `fr`). En una acción **Enviar un mensaje**,
  escriba `{{` y elija **Traducción**.

- **LibreTranslate: detectar el idioma**: indica el idioma de un **Texto**, entre los que el
  servidor ha cargado. Resultados: **Idioma (código)** (`{{0.1.language}}`, por ejemplo `de`),
  **Idioma (nombre)** (`{{0.1.language_name}}`, en el idioma de la configuración) y **Confianza
  (%)** (`{{0.1.confidence}}`).

Cuando una acción falla (servidor parado, idioma no cargado, clave rechazada, texto vacío),
Gladys muestra el motivo en rojo, la acción no da resultado y la escena continúa.

### Ideas de escenas

- **Mensajes para un invitado**: cuando un modo invitado está activo, traduzca las
  notificaciones a su idioma antes de enviarlas.
- **Alertas habladas en dos idiomas**: traduzca «La lavadora ha terminado.» y lea las dos
  versiones en un altavoz.
- **Responder en el idioma correcto**: detecte el idioma de un mensaje recibido y traduzca la
  respuesta a ese idioma.

## Solución de problemas

- **«sin respuesta»**: compruebe la dirección y el puerto (5000), que el servidor
  esté en marcha y, con Docker, que el puerto esté publicado. El primer arranque descarga los
  modelos: puede tardar varios minutos.
- **«idioma … no cargado en el servidor»**: el servidor se inició con `--load-only` sin ese
  idioma. Añádalo y reinicie el servidor.
- **«este servidor exige una clave de API»** / **«clave de API rechazada»**: introduzca la clave
  en la configuración o cree una con `ltmanage keys add` en el servidor.
- **«demasiadas solicitudes»**: el servidor limita las solicitudes (`--req-limit`, o la oferta de
  una instancia pública).
- Problemas e ideas:
  [issues de GitHub](https://github.com/guim31/gladys-libretranslate/issues).

## Límites

- Traducción automática: buena para notificaciones cortas, menos para textos largos o con
  matices.
- Solo texto, hasta 10.000 caracteres por acción (lo que Gladys devuelve a una escena).
- La detección es fiable con una frase, mucho menos con una o dos palabras.
- Los textos y sus traducciones nunca van a los registros de la integración.
