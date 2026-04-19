# Core
* The metric can be set/changed for the canvas (feet, inches, cm, etc.) and the segment sizes will display in that 
* Define objects
* An object is a collection of points
    * Type 1 - standard (starts as a square)
    * Type 2 - round (starts as a circle)
        * No editing of points
        * Only support length and width
* Standard Objects
    * A segment (between two points) can be selected
    * Any point can be selected
    * Points can be dragged to adjust the shape by the user
    * A segment has a length - implied by its points
    * A segment can be split, resulting in a new point being added at the center of the segment
    * The user can change the length of a segment (the points adjust automatically)
    * Locking
        * A point can be locked, preventing it from moving
        * A segment can be locked, preventing its length from changing
            * Either point of the segment can still be dragged, but will always remain the same distance from its paired point
        * If both points of a segment at locked, the segment length cannot be changed/modified
    * By dragging the mouse or shift clicking points, multiple can be selected and then moved together
* Object attributes
    * Visual
        * Line color
        * Fill color
        * Line thickness
    * Notes
    * Total width and height
    * Locked - if enabled, the entire object is locked and can only be moved, not re-sized
    * Name
    * URL
    * Supplementary dimensions
        * Height (optional)
        * Define your own (for example, if the object represents a chair, the height of the seat may be custom defined)
    * Type (user can define types that are shared between objects for grouping/classification) - e.g. Chair, Sofa, Table, etc.
    * Owned - a boolean that indicates if the object is owned (already purchased); this is used if the object represents furniture to differenciate between proposed and owned
    * Cost ($)
    * Images - user can attach images to the object
* Point attributes
    * Snapping - determines if a point will snap to other points that also have snapping enabled
        * If they are close enough together when moving the object, the object will move so that the points perfectly overlap
* Object actions
    * Duplicate
    * Lock/unlock
    * Rotation
* Templates
    * An object can be saved as a template to be inserted into the canvas multiple times
    * When saving a template, store the points in unit form (1x1 total size)
    * When creating an object from a template
        * Ask the user what size in units are desired
        * Ask the user for a name

# UI
* Create one or more models
    * A model is a sqlite db file
    * Opening a model is to select a sqlite db
* All catalogs are searchable
* Object catalog - a list of all object in the canvas
* Template catalog
* Layer catalog
    * Layers can be hidden - this is used to create options when designing rooms or simplifying the model for certain purposes
    * Cost - the total cost of a layer is the sum of the cost of all objects/layers inside the layer
* Object hierarchy
    * User can define layers
    * Layers can contain other layers and/or objects
    * Think of this similar to a folder/directory structure
    * Objects and layers can be dragged between layers
* Hovering over any segment will display its length and name in a quick tool-tip
* Clicking a segment, or point will bring up a side-panel with the segment or point attributes in one section and the object details in the other section
* A selected segment or point will be colored to indicate it is selected
* The points of a selected object will be indicated but softer than the directly selected components