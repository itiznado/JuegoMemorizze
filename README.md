¿Donde te ayudó la IA y dónde te dio código incorrecto o de mala calidad que tuviste que corregir?

La IA basicamente me ayudo a lo largo de todo el trabajo y escribio casi todo el código. Aunque si existian algunas veces que solicitaba cambiar la posición de algunas secciones o el tamaño y esta no me entendia. Luego de algunos prompts si se pudo arreglar, pero algunos de esos errores (especialmente los de tamaño) termine escribiendo yo el código para que quedara como a mi me parecia correcto. En si todo lo hizo la IA, pero fuimos desarrollandolo paso a paso por solicitud mia.

Justifica dos decisiones de diseño de tu app.

innerHTML destruye el contenido convirtiendo texto en HTML, permitiendo una entrada para XSS. Sin usar innerHTML, se aplicó "replaceChildren()" sin ningun argumento, asi se vacía el nodo de forma segura.
La delegación de eventos a comparación del uso de varios EventListener optimiza el consumo de memoria sin tener que usar un listener por cada carta por ejemplo. En el caso del modo dificil, con 36 cartas implicaría 36 listener, esto también implica removerlos manualmente al reiniciarlo.
Para este caso donde los elementos hijos se crean, destruyen y/o reordenan, usar delegación es una de las mejores prácticas al desarrollar páginas web.

Una cosa que mejorarías con más tiempo.

Me gustaría agregar otras funciones como un tablero de los mejores tiempos a diferencia de un solo intento siendo seleccionado como el mejor. Este tablero con nombres para saber con quien compites y para dejar tu sello en tu intento.
También quisiera agregar una forma de que las tarjetas giren al hacerles click, pero en 3D. No instantaneamente, sino que vea como se da vuelta una carta de verdad.