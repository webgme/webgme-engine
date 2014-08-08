/**
 * Created by tkecskes on 8/4/2014.
 */
define(['addon/AddOnBase'],function(Base) {

    'use strict';
    var ConstraintAddOn = function (core, storage) {
        Base.call(this, core, storage);
    };

    ConstraintAddOn.prototype = Object.create(Base.prototype);
    ConstraintAddOn.prototype.constructor = ConstraintAddOn;

    ConstraintAddOn.prototype.root = null;
    ConstraintAddOn.prototype.contraints = {};
    ConstraintAddOn.prototype.contraintsStorage = {};

    ConstraintAddOn.prototype.getName = function () {
        return 'ConstraintAddOn';
    };

    ConstraintAddOn.prototype.update = function (root) {
        //TODO if we would like a continuous constraint checking we should use this function as well
        this.root = root;
    };

    ConstraintAddOn.prototype.query = function (parameters, callback) {
        var self = this;
        //several query will be available but the first is the simple run constraint
        switch (parameters.querytype){
            case 'checkProject':
                this.checkProject(callback);
                break;
            case 'checkModel':
                self.loadNode(parameters.path,function(err,node){
                    if(err){
                        return callback(err);
                    }
                    self.checkModel(node,callback);
                });
                break;
            case 'checkNode':
                self.loadNode(parameters.path,function(err,node){
                    if(err){
                        return callback(err);
                    }
                    self.checkNode(node,callback);
                });
                break;
            default:
                callback('unknown command');
        }
    };

    ConstraintAddOn.prototype.start = function(parameters,callback){
        var self = this;
        Base.prototype.start.call(this,parameters,function(err){
            if(err){
                return callback(err);
            }
            self.project.getBranchHash(self.branchName,"#hack",function(err,commitHash){
                if(err){
                    return callback(err);
                }
                self.project.loadObject(commitHash,function(err,commit){
                    if(!err && commit){
                        self.commit = commit;
                        self.core.loadRoot(commit.root,function(err,root){
                            if(!err && root){
                                self.root = root;
                                callback(null);
                            } else {
                                callback(err || "cannot load initial root");
                            }
                        });
                    } else {
                        callback(err || "cannot find the starting commit");
                    }
                });
            });
        });
    };

    ConstraintAddOn.prototype.stop = function (callback) {
        callback(null);
    };

    ConstraintAddOn.prototype.checkProject = function(callback){
        this.checkModel(this.root,callback);
    };
    ConstraintAddOn.prototype.checkModel = function(root,callback){
        var self = this,
            error = null,
            message = {},
            checkChild = function(node,cb){
                var needed = 2,
                    children = [],
                    nextChild = function(index){
                        if(index>=children.length){
                            return cb(error,message);
                        }

                        checkChild(children[index],function(){
                            nextChild(index+1);
                        });
                    },
                    childrenLoaded = function(){
                        needed = children.length;
                        if(!needed || needed === 0){
                            return cb(error,message);
                        }
                        nextChild(0);
                    };
                self.checkNode(node,function(err,msg){
                    error = error || err;
                    message[self.core.getGuid(node)] = msg;
                    if(--needed === 0){
                        childrenLoaded();
                    }
                });
                self.core.loadChildren(node,function(err,c){
                    children = c || [];
                    error = error || err;
                    if(--needed === 0){
                        childrenLoaded();
                    }
                });
            };

        checkChild(root,callback);
    };
    ConstraintAddOn.prototype.checkNode = function(node,callback){
        var self = this,
            message = {},
            error = null,
            names = self.core.getConstraintNames(node),
            needed = names.length,
            i,
            check = function(name){
                self.executeContraint(node,name,function(err,msg){
                    error = error || err;
                    message[name] = msg;

                    if(--needed === 0){
                        callback(error,message);
                    }
                });
            };

        if(needed > 0){
            for(i=0;i<names.length;i++){
                check(names[i]);
            }
        } else {
            callback(error,message);
        }
    };
    ConstraintAddOn.prototype.loadNode = function(path,callback){
        this.core.loadByPath(this.root,path,callback);
    };
    ConstraintAddOn.prototype.executeContraint = function(node,name,callback){
        var self = this,
            script = self.core.getConstraint(node,name).script;

        if(!self.contraints[script]){
            var a="";
            eval("a = "+script);
            self.contraints[script] = a;
            self.contraintsStorage[script] = {};
        }
        self.contraints[script].call(self.contraintsStorage[script],self.core,node,callback);
    };

    return ConstraintAddOn;
});