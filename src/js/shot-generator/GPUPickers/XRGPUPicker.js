const GPUPicker = require("./GPUPicker");
const SkeletonUtils = require("../IK/utils/SkeletonUtils");
class XRGPUPicker extends GPUPicker
{
    constructor()
    {
        super();
        this.addedGroupsId = [];
        this.allowedObjectsTypes = [ "object", "character", "bonesHelper" , "virtual-camera", "light" ];
        this.idBonus = 400;
    }

    initalizeChildren(intersectObjects)
    {
        super.initalizeChildren(intersectObjects);
        let objects = [];
        let additionalObjects = [];
        let updatedGuiUuid = [];
        for(let i = 0, n = intersectObjects.length; i < n; i++)
        {
            let intesectable = intersectObjects[i];
            if(intesectable.userData.type === "gui" && !updatedGuiUuid[intesectable.uuid])
            {
                updatedGuiUuid[intesectable.uuid] = true;
                this.getGuiMeshes(intesectable, objects);
                continue;
            }
            if(this.addedGroupsId.some(group => group === intesectable.uuid))
            {
                continue;
            }
            this.getAllSceneMeshes(intesectable, objects, additionalObjects);
            this.addedGroupsId.push(intesectable.uuid);
        }
        let sceneElementsAmount = this.pickingScene.children.length;
        for(let i = 0, n = objects.length; i < n; i++)
        {
            let object = objects[i];
            const id = sceneElementsAmount + i + this.idBonus;
            const pickingMaterial = new THREE.MeshPhongMaterial({
                emissive: new THREE.Color(id),
                color: new THREE.Color(0, 0, 0),
                specular: 0x0,
                skinning: true,
                shininess: 0,
                flatShading: false,
                morphNormals: true,
                morphTargets: true
              });
            let pickingCube = null;
            let node = new THREE.Object3D();

            if(object.type === "SkinnedMesh")
            {
                let parent = null;
                parent = object.parent.parent;
                let userData = parent.userData;
                parent.userData = [];
                node = SkeletonUtils.clone(parent);
                parent.userData = userData;
                // Removes load
                let lod = node.children[0];
                lod.levels.pop();
                lod.levels.pop();
                lod.levels.pop();
                lod.levels.pop();
                // removes load
                pickingCube = node.children[0].children[0];
                pickingCube.material = pickingMaterial;
                pickingCube.matrixWorldNeedsUpdate = true;
                pickingCube.visible = true;
                node.type = "character";
                let {cones, selectable} = this.initializeCones(additionalObjects[parent.parent.uuid]);
                node.cones = cones;
                node.selectable = selectable;
            }
            else if(object.userData && object.userData.type === "gui")
            {
                pickingCube = new THREE.Mesh(object.geometry, pickingMaterial);
                node.type = "gui"
                node.add(pickingCube);
            }
            else
            {  
                pickingCube = new THREE.Mesh(object.geometry, pickingMaterial);
                node.type = "object";
                node.add(pickingCube);
            }
            this.pickingScene.add(node);
            node.pickerId = id;
            pickingCube.pickerId = id;
            this.gpuPickerHelper.selectableObjects[id] = { originObject: object, pickerObject: node} ;
        } 
    }
  
    updateObject()
    {
        super.updateObject();
        for(let i = 0, n = this.pickingScene.children.length; i < n; i++)
        {
            let clonnedObject = this.pickingScene.children[i];
            let originalObject = originalObject = clonnedObject.type === "object" ? this.gpuPickerHelper.selectableObjects[clonnedObject.pickerId].originObject : this.gpuPickerHelper.selectableObjects[clonnedObject.pickerId].originObject.parent;
            if(!originalObject)
            {
                continue;
            }
            clonnedObject.position.copy(originalObject.worldPosition());
            clonnedObject.quaternion.copy(originalObject.worldQuaternion());
            clonnedObject.scale.copy(originalObject.worldScale());
            clonnedObject.updateMatrixWorld(true);
            if(clonnedObject.type === "character" && this.gpuPickerHelper.selectableObjects[clonnedObject.pickerId].originObject.skeleton)
            {
                let clonnedSkinnedMesh = null;
                clonnedSkinnedMesh = clonnedObject.children[0].children.find(child => child.type === "SkinnedMesh");
                let originalSkinnedMesh = this.gpuPickerHelper.selectableObjects[clonnedObject.pickerId].originObject;
            
                let originalRootBone = originalSkinnedMesh.skeleton.bones[0];
                let clonnedRootBone = clonnedSkinnedMesh.skeleton.bones[0];
           
                this.updateSkeletonBone(clonnedRootBone, originalRootBone);
                clonnedRootBone.updateMatrixWorld(true);
                this.updateCones(clonnedObject.cones);
            }
        }
    }

    getAllSceneMeshes(sceneMesh, meshes, additionalObjects)
    {
        super.getAllSceneMeshes();
        let sceneChildren = sceneMesh.children;
        if(sceneChildren === undefined )
        {
            return;
        }
        
        if(sceneMesh.userData && this.allowedObjectsTypes.some(allowedObjects => allowedObjects === sceneMesh.userData.type))
        {
            if(sceneMesh.userData.type === "virtual-camera" || sceneMesh.userData.type === "light")
            {
                sceneChildren = sceneMesh.children[0].children;
            }
            for(let i = 0, n = sceneChildren.length; i < n; i++)
            {
                let child = sceneChildren[i];
                if(child.type === "Mesh") 
                {
                    meshes.push(child); 
                    //return;
                }  

                if(child.children.length !== 0 && child.children[0].type === "BonesHelper")
                {
                    additionalObjects[sceneMesh.uuid] = child.children[0].cones;
                    return;
                }

                if(child.children.length !== 0 && child.children[0].type === "LOD")
                {
                    meshes.push(child.children[0].children[0]);
                }
            }   
        }
        for(let i = 0, n = sceneChildren.length; i < n; i++)
        {
            this.getAllSceneMeshes(sceneChildren[i], meshes);
        }
    }

    getGuiMeshes(gui, meshes)
    {
        if(gui.userData && gui.userData.type === "gui")
        {
            gui.traverse(object =>
            {
                if(!this.isObjectAdded(object) && object.type === "Mesh" 
                    && !object.name.includes("_icon") && !object.name !== ""
                    && object.visible) 
                {
                    meshes.push(object); 
                    return;
                }  
            });
        }
    }
}
module.exports = XRGPUPicker;
