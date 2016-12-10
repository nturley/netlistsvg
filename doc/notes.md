# Notes

This is confusing because we have a lot of different node models

1. Initial module
2. Reformatted module
3. kGraph nodes
4. processed kgraph nodes
5. template node
6. output node

Information needed from Node
* key
* type
* ports
 * id

Information needed from Wire
* id
* source node id
* source port id
* target node id
* target port id

Information needed from Template/Skin
* id
* alias list
* label
 * x,y
* width/height
* ports
 * x,y
 * id
 * label
  * x,y

kgraph node
* id (from node.key)
* width/height (from template)
* labels
 * text (from node.type)
 * x,y (from template.label)
 * width/height (from skin settings)
* ports
 * id (from node.ports.id)
 * x,y (from template)
 * labels
    * text (from node.ports.id)
    * x,y (from template)
    * width/height (from skin settings)

